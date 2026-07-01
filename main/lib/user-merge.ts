import { Prisma } from "@prisma/client";

/** 把含 BigInt / Date 的 Prisma 行转成可存入 Json 列的纯 JSON 值 */
function toJsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v
    )
  );
}

/**
 * 将 `sourceUserId` 合并进 `targetUserId`：
 *  1. 合并前对源账号做【完整快照】（含会被改动的目标行），写入 user_merge_logs，用于将来撤回；
 *  2. 冲突数据做字段级合并（并集 / 取高 / 取和），非冲突数据整行 repoint；
 *  3. 源账号【软删除】（status=MERGED、mergedIntoId 指向 target、手机号置空以释放唯一约束），
 *     不物理删除，保证 0 丢失、可回溯。
 *
 * 典型场景：微信用户绑定手机号时发现该号码已被一个自由注册账号占用，
 * 用户显式确认后把自由注册账号（source）合并进当前微信账号（target）。
 *
 * 必须在事务内调用。Prisma 交互式事务共用单连接，故此处全部顺序 await（不用 Promise.all）。
 */
export async function mergeUserRelations(
  tx: Prisma.TransactionClient,
  sourceUserId: string,
  targetUserId: string
): Promise<void> {
  if (sourceUserId === targetUserId) {
    throw new Error("mergeUserRelations: source 与 target 不能相同");
  }

  const sourceUser = await tx.user.findUnique({ where: { id: sourceUserId } });
  if (!sourceUser) {
    throw new Error("mergeUserRelations: 源用户不存在");
  }

  // ===================== Phase A：合并前快照（0 丢失，供撤回）=====================
  // 源账号名下的全部数据。sessions / walletNonces 属临时数据不快照（撤回后重登即可再生）。
  const [
    srcAccounts,
    srcApiKeys,
    srcInteractions,
    srcPermissions,
    srcLikes,
    srcProgress,
    srcSubmissionsOwned,
    srcSubmissionsReviewed,
    srcComments,
    srcMessages,
    srcGameAnswers,
    srcHistoryOwned,
    srcHistoryContributed,
    srcActivitiesCreated,
    srcReviewBatchesCreated,
    srcCategoriesAssigned,
    srcTagsCreated,
    srcAuditOperator,
    srcAuditTarget,
  ] = [
    await tx.account.findMany({ where: { userId: sourceUserId } }),
    await tx.api_key.findMany({ where: { user_id: sourceUserId } }),
    await tx.user_corpus_interactions.findMany({
      where: { user_id: sourceUserId },
    }),
    await tx.user_corpus_permissions.findMany({
      where: { user_id: sourceUserId },
    }),
    await tx.corpus_collection_likes.findMany({
      where: { user_id: sourceUserId },
    }),
    await tx.game_player_progress.findUnique({
      where: { user_id: sourceUserId },
    }),
    await tx.corpus_collection_submissions.findMany({
      where: { user_id: sourceUserId },
    }),
    await tx.corpus_collection_submissions.findMany({
      where: { reviewed_by: sourceUserId },
    }),
    await tx.corpus_collection_comments.findMany({
      where: { user_id: sourceUserId },
    }),
    await tx.corpus_collection_messages.findMany({
      where: { user_id: sourceUserId },
    }),
    await tx.game_answer_records.findMany({ where: { user_id: sourceUserId } }),
    await tx.cantonese_corpus_update_history.findMany({
      where: { user_id: sourceUserId },
    }),
    await tx.cantonese_corpus_update_history.findMany({
      where: { contributor_user_id: sourceUserId },
    }),
    await tx.corpus_collection_activities.findMany({
      where: { created_by: sourceUserId },
    }),
    await tx.corpus_collection_review_batches.findMany({
      where: { created_by: sourceUserId },
    }),
    await tx.corpus_category.findMany({ where: { assigned_by: sourceUserId } }),
    await tx.corpus_tags.findMany({ where: { created_by: sourceUserId } }),
    await tx.permission_audit_logs.findMany({
      where: { operator_id: sourceUserId },
    }),
    await tx.permission_audit_logs.findMany({
      where: { target_user_id: sourceUserId },
    }),
  ];

  // 会被「字段级合并」改动的目标行，也要快照原值，撤回时才能还原目标账号
  const [tgtInteractionsBefore, tgtPermissionsBefore, tgtProgressBefore] = [
    await tx.user_corpus_interactions.findMany({
      where: { user_id: targetUserId },
    }),
    await tx.user_corpus_permissions.findMany({
      where: { user_id: targetUserId },
    }),
    await tx.game_player_progress.findUnique({
      where: { user_id: targetUserId },
    }),
  ];

  const snapshot = toJsonSafe({
    version: 1,
    source_user: sourceUser,
    source_rows: {
      accounts: srcAccounts,
      api_key: srcApiKeys,
      user_corpus_interactions: srcInteractions,
      user_corpus_permissions: srcPermissions,
      corpus_collection_likes: srcLikes,
      game_player_progress: srcProgress,
      corpus_collection_submissions_owned: srcSubmissionsOwned,
      corpus_collection_submissions_reviewed: srcSubmissionsReviewed,
      corpus_collection_comments: srcComments,
      corpus_collection_messages: srcMessages,
      game_answer_records: srcGameAnswers,
      cantonese_corpus_update_history_owned: srcHistoryOwned,
      cantonese_corpus_update_history_contributed: srcHistoryContributed,
      corpus_collection_activities_created: srcActivitiesCreated,
      corpus_collection_review_batches_created: srcReviewBatchesCreated,
      corpus_category_assigned: srcCategoriesAssigned,
      corpus_tags_created: srcTagsCreated,
      permission_audit_logs_operator: srcAuditOperator,
      permission_audit_logs_target: srcAuditTarget,
    },
    target_before: {
      user_corpus_interactions: tgtInteractionsBefore,
      user_corpus_permissions: tgtPermissionsBefore,
      game_player_progress: tgtProgressBefore,
    },
  });

  // ===================== Phase B：字段级合并（冲突 0 丢失）=====================

  // user_corpus_interactions @@unique([user_id, corpus_unique_id])：布尔标记取并集
  for (const s of srcInteractions) {
    const t = await tx.user_corpus_interactions.findFirst({
      where: { user_id: targetUserId, corpus_unique_id: s.corpus_unique_id },
    });
    if (t) {
      await tx.user_corpus_interactions.update({
        where: { id: t.id },
        data: {
          is_liked: t.is_liked || s.is_liked,
          is_bookmarked: t.is_bookmarked || s.is_bookmarked,
          is_viewed: t.is_viewed || s.is_viewed,
          category: t.category ?? s.category,
        },
      });
      await tx.user_corpus_interactions.delete({ where: { id: s.id } });
    } else {
      await tx.user_corpus_interactions.update({
        where: { id: s.id },
        data: { user_id: targetUserId },
      });
    }
  }

  // user_corpus_permissions @@unique([user_id, category_name])：取更高等级
  const PERM_RANK: Record<string, number> = {
    READ: 0,
    WRITE: 1,
    CREATE: 2,
    FULL: 3,
  };
  for (const s of srcPermissions) {
    const t = await tx.user_corpus_permissions.findFirst({
      where: { user_id: targetUserId, category_name: s.category_name },
    });
    if (t) {
      if ((PERM_RANK[s.permission] ?? 0) > (PERM_RANK[t.permission] ?? 0)) {
        await tx.user_corpus_permissions.update({
          where: { id: t.id },
          data: { permission: s.permission },
        });
      }
      await tx.user_corpus_permissions.delete({ where: { id: s.id } });
    } else {
      await tx.user_corpus_permissions.update({
        where: { id: s.id },
        data: { user_id: targetUserId },
      });
    }
  }

  // corpus_collection_likes @@unique([submission_id, user_id])：去重后点赞仍在，重算 like_count
  const dedupedSubmissionIds: bigint[] = [];
  for (const s of srcLikes) {
    const t = await tx.corpus_collection_likes.findFirst({
      where: { user_id: targetUserId, submission_id: s.submission_id },
    });
    if (t) {
      await tx.corpus_collection_likes.delete({ where: { id: s.id } });
      dedupedSubmissionIds.push(s.submission_id);
    } else {
      await tx.corpus_collection_likes.update({
        where: { id: s.id },
        data: { user_id: targetUserId },
      });
    }
  }
  for (const submissionId of dedupedSubmissionIds) {
    const likeCount = await tx.corpus_collection_likes.count({
      where: { submission_id: submissionId },
    });
    await tx.corpus_collection_submissions.update({
      where: { id: submissionId },
      data: { like_count: likeCount },
    });
  }

  // game_player_progress（一对一累计快照）：计数取和、连续天数取大、最后游玩日取晚、正确率重算
  if (srcProgress) {
    if (tgtProgressBefore) {
      const graded =
        tgtProgressBefore.graded_questions + srcProgress.graded_questions;
      const correct =
        tgtProgressBefore.correct_questions + srcProgress.correct_questions;
      const LEVEL_RANK: Record<string, number> = {
        none: 0,
        A: 1,
        B: 2,
        C: 3,
        D: 4,
      };
      const mergedLevel =
        (LEVEL_RANK[srcProgress.level] ?? 0) >
        (LEVEL_RANK[tgtProgressBefore.level] ?? 0)
          ? srcProgress.level
          : tgtProgressBefore.level;
      const playedDates = [
        tgtProgressBefore.last_played_date,
        srcProgress.last_played_date,
      ].filter((d): d is Date => d != null);
      const lastPlayedDate =
        playedDates.length > 0
          ? playedDates.reduce((a, b) => (a > b ? a : b))
          : null;

      await tx.game_player_progress.update({
        where: { user_id: targetUserId },
        data: {
          total_time_seconds:
            tgtProgressBefore.total_time_seconds +
            srcProgress.total_time_seconds,
          completed_questions:
            tgtProgressBefore.completed_questions +
            srcProgress.completed_questions,
          correct_questions: correct,
          graded_questions: graded,
          accuracy: graded > 0 ? correct / graded : 0,
          current_streak_days: Math.max(
            tgtProgressBefore.current_streak_days,
            srcProgress.current_streak_days
          ),
          last_played_date: lastPlayedDate,
          context_completed:
            tgtProgressBefore.context_completed +
            srcProgress.context_completed,
          sound_completed:
            tgtProgressBefore.sound_completed + srcProgress.sound_completed,
          image_completed:
            tgtProgressBefore.image_completed + srcProgress.image_completed,
          context_correct:
            tgtProgressBefore.context_correct + srcProgress.context_correct,
          sound_correct:
            tgtProgressBefore.sound_correct + srcProgress.sound_correct,
          image_correct:
            tgtProgressBefore.image_correct + srcProgress.image_correct,
          level: mergedLevel,
        },
      });
      await tx.game_player_progress.delete({
        where: { user_id: sourceUserId },
      });
    } else {
      await tx.game_player_progress.update({
        where: { user_id: sourceUserId },
        data: { user_id: targetUserId },
      });
    }
  }

  // ---- 无冲突外键：直接 repoint ----
  await tx.account.updateMany({
    where: { userId: sourceUserId },
    data: { userId: targetUserId },
  });
  await tx.api_key.updateMany({
    where: { user_id: sourceUserId },
    data: { user_id: targetUserId },
  });
  await tx.game_answer_records.updateMany({
    where: { user_id: sourceUserId },
    data: { user_id: targetUserId },
  });
  await tx.corpus_collection_submissions.updateMany({
    where: { user_id: sourceUserId },
    data: { user_id: targetUserId },
  });
  await tx.corpus_collection_comments.updateMany({
    where: { user_id: sourceUserId },
    data: { user_id: targetUserId },
  });
  await tx.corpus_collection_messages.updateMany({
    where: { user_id: sourceUserId },
    data: { user_id: targetUserId },
  });
  await tx.cantonese_corpus_update_history.updateMany({
    where: { user_id: sourceUserId },
    data: { user_id: targetUserId },
  });

  // 可空的「创建者 / 审核者 / 指派者」引用
  await tx.corpus_collection_submissions.updateMany({
    where: { reviewed_by: sourceUserId },
    data: { reviewed_by: targetUserId },
  });
  await tx.corpus_collection_activities.updateMany({
    where: { created_by: sourceUserId },
    data: { created_by: targetUserId },
  });
  await tx.corpus_collection_review_batches.updateMany({
    where: { created_by: sourceUserId },
    data: { created_by: targetUserId },
  });
  await tx.corpus_category.updateMany({
    where: { assigned_by: sourceUserId },
    data: { assigned_by: targetUserId },
  });
  await tx.corpus_tags.updateMany({
    where: { created_by: sourceUserId },
    data: { created_by: targetUserId },
  });
  await tx.cantonese_corpus_update_history.updateMany({
    where: { contributor_user_id: sourceUserId },
    data: { contributor_user_id: targetUserId },
  });
  await tx.permission_audit_logs.updateMany({
    where: { operator_id: sourceUserId },
    data: { operator_id: targetUserId },
  });
  await tx.permission_audit_logs.updateMany({
    where: { target_user_id: sourceUserId },
    data: { target_user_id: targetUserId },
  });

  // 临时数据：直接删除（不快照，撤回后重登即可再生）
  await tx.session.deleteMany({ where: { userId: sourceUserId } });
  await tx.walletNonce.deleteMany({ where: { userId: sourceUserId } });

  // ===================== Phase C：软删除源账号 + 写归档日志 =====================
  await tx.user.update({
    where: { id: sourceUserId },
    data: {
      status: "MERGED",
      mergedIntoId: targetUserId,
      // 置空手机号以释放 @unique，交由 target 承接；原值已存入快照
      phoneNumber: null,
    },
  });

  await tx.user_merge_logs.create({
    data: {
      source_user_id: sourceUserId,
      target_user_id: targetUserId,
      phone_number: sourceUser.phoneNumber,
      snapshot,
    },
  });
}

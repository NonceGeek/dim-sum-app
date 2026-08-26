import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  QuestionnaireAnswers,
  QuestionnaireError,
  validateQuestionnaireAnswers,
} from "@/lib/services/questionnaire-schema";
import {
  getPublishedQuestionnaireSchema,
  getQuestionnaireDefinitionByVersion,
  getQuestionnaireSchemaByVersion,
} from "@/lib/services/questionnaire-definition";

const JOURNEY_TTL_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function maskPhone(phoneNumber: string | null) {
  return phoneNumber ? `${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-4)}` : null;
}

export function assertQuestionnaireActivitySubmittable(activity: {
  status: string;
  starts_at: Date | null;
  ends_at: Date | null;
}) {
  const now = Date.now();
  if (
    activity.status !== "published" ||
    (activity.starts_at && activity.starts_at.getTime() > now) ||
    (activity.ends_at && activity.ends_at.getTime() < now)
  ) {
    throw new QuestionnaireError("ACTIVITY_NOT_SUBMITTABLE", 422, "活动当前不可投稿");
  }
}

function assertJourneyActive(journey: { expires_at: Date }) {
  if (journey.expires_at.getTime() <= Date.now()) {
    throw new QuestionnaireError("JOURNEY_EXPIRED", 410, "参赛旅程已过期");
  }
}

export function getQuestionnaireEntryNavigation(
  flowType: string,
  status: string,
) {
  const canOpenSubmission =
    flowType === "reused" && status === "entered_submission";
  const nextAction =
    flowType === "full_questionnaire"
      ? "show_questionnaire_intro"
      : flowType === "phone_only"
        ? "show_phone_binding"
        : canOpenSubmission
          ? "open_submission_page"
          : "enter_submission";

  return { canOpenSubmission, nextAction };
}

function entryResponse(journey: {
  id: string;
  activity_id: bigint | null;
  flow_type: string;
  registration_type: string;
  status: string;
  expires_at: Date;
  user: { phoneNumber: string | null };
}, questionnaire: Awaited<ReturnType<typeof getPublishedQuestionnaireSchema>> | null) {
  const verified = Boolean(journey.user.phoneNumber);
  const { canOpenSubmission, nextAction } = getQuestionnaireEntryNavigation(
    journey.flow_type,
    journey.status,
  );
  return {
    journeyId: journey.id,
    ...(canOpenSubmission
      ? {
          questionnaireJourneyId: journey.id,
          activityId: journey.activity_id?.toString() ?? null,
          allowed: true,
        }
      : {}),
    flowType: journey.flow_type,
    registrationType: journey.registration_type,
    nextAction,
    expiresAt: journey.expires_at.toISOString(),
    contact: {
      status: verified ? "verified" : "missing",
      maskedPhoneNumber: maskPhone(journey.user.phoneNumber),
    },
    questionnaire: journey.flow_type === "full_questionnaire" ? questionnaire : null,
  };
}

export async function createQuestionnaireJourney(
  userId: string,
  input: { activityId?: string; clientEventId: string },
) {
  const activityId = input.activityId ? BigInt(input.activityId) : null;
  const existing = await prisma.corpus_collection_questionnaire_journeys.findUnique({
    where: { entry_client_event_id: input.clientEventId },
    include: { user: { select: { phoneNumber: true } } },
  });
  if (existing) {
    if (existing.user_id !== userId || existing.activity_id !== activityId) {
      throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "幂等键已用于其他参赛旅程");
    }
    const questionnaire = existing.flow_type === "full_questionnaire"
      ? await getQuestionnaireSchemaByVersion(existing.schema_version!)
      : null;
    return entryResponse(existing, questionnaire);
  }

  const [activity, user] = await Promise.all([
    activityId
      ? prisma.corpus_collection_activities.findUnique({
          where: { id: activityId },
          select: { id: true, status: true, starts_at: true, ends_at: true },
        })
      : Promise.resolve(null),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phoneNumber: true,
        questionnaireProfile: { select: { id: true } },
      },
    }),
  ]);
  if (activityId && !activity) throw new QuestionnaireError("ACTIVITY_NOT_FOUND", 404, "活动不存在");
  if (!user) throw new QuestionnaireError("AUTH_REQUIRED", 401, "用户不存在");
  if (activity) assertQuestionnaireActivitySubmittable(activity);

  const profile = user.questionnaireProfile;
  const flowType = profile ? (user.phoneNumber ? "reused" : "phone_only") : "full_questionnaire";
  const questionnaire = flowType === "full_questionnaire"
    ? await getPublishedQuestionnaireSchema()
    : null;
  const now = new Date();
  const journey = await prisma.$transaction(async (tx) => {
    const canOpenSubmission = flowType === "reused";
    const created = await tx.corpus_collection_questionnaire_journeys.create({
      data: {
        entry_client_event_id: input.clientEventId,
        user_id: userId,
        activity_id: activityId,
        flow_type: flowType,
        registration_type: profile ? "reused" : "first_time",
        schema_version: questionnaire?.schemaVersion ?? null,
        status: canOpenSubmission ? "entered_submission" : "started",
        completed_at: canOpenSubmission ? now : null,
        entered_submission_at: null,
        expires_at: new Date(now.getTime() + JOURNEY_TTL_MS),
      },
      include: { user: { select: { phoneNumber: true } } },
    });
    await tx.corpus_collection_questionnaire_events.create({
      data: {
        event_id: crypto.randomUUID(),
        journey_id: created.id,
        user_id: userId,
        activity_id: activityId,
        event_name: "click_submit_cta",
        flow_type: flowType,
      },
    });
    return created;
  });
  return entryResponse(journey, questionnaire);
}

export async function recordQuestionnaireClientEvent(
  userId: string,
  input: { journeyId: string; clientEventId: string; eventName: string },
) {
  const journey = await prisma.corpus_collection_questionnaire_journeys.findFirst({
    where: { id: input.journeyId, user_id: userId },
  });
  if (!journey) throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "参赛旅程不存在");
  assertJourneyActive(journey);
  if (input.eventName === "cancel_questionnaire" && journey.status === "submitted") {
    throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "已投稿旅程不能取消");
  }
  if (
    input.eventName === "enter_submission_page" &&
    !["completed", "entered_submission", "submitted"].includes(journey.status)
  ) {
    throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "参赛旅程尚未允许进入投稿页");
  }
  const existingEvent = await prisma.corpus_collection_questionnaire_events.findUnique({
    where: { event_id: input.clientEventId },
  });
  if (
    existingEvent &&
    (existingEvent.journey_id !== journey.id ||
      existingEvent.user_id !== userId ||
      existingEvent.event_name !== input.eventName)
  ) {
    throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "事件幂等键已用于其他操作");
  }
  await prisma.$transaction([
    prisma.corpus_collection_questionnaire_events.upsert({
      where: { event_id: input.clientEventId },
      create: {
        event_id: input.clientEventId,
        journey_id: journey.id,
        user_id: userId,
        activity_id: journey.activity_id,
        event_name: input.eventName,
        flow_type: journey.flow_type,
      },
      update: {},
    }),
    ...(input.eventName === "cancel_questionnaire"
      ? [prisma.corpus_collection_questionnaire_journeys.update({
          where: { id: journey.id },
          data: { status: "cancelled" },
        })]
      : input.eventName === "enter_submission_page"
        ? [prisma.corpus_collection_questionnaire_journeys.update({
            where: { id: journey.id },
            data: {
              status: journey.status === "completed" ? "entered_submission" : journey.status,
              entered_submission_at: journey.entered_submission_at ?? new Date(),
            },
          })]
      : []),
  ]);
  return { success: true, eventId: input.clientEventId };
}

export async function completeQuestionnaireJourney(
  userId: string,
  input: { journeyId: string; schemaVersion?: number; answers?: QuestionnaireAnswers },
) {
  const journey = await prisma.corpus_collection_questionnaire_journeys.findFirst({
    where: { id: input.journeyId, user_id: userId },
    include: { user: { select: { phoneNumber: true } } },
  });
  if (!journey) throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "参赛旅程不存在");
  assertJourneyActive(journey);
  if (!journey.user.phoneNumber) {
    throw new QuestionnaireError("PHONE_CODE_INVALID", 400, "请先完成手机号验证");
  }
  if (["completed", "entered_submission", "submitted"].includes(journey.status)) {
    const profile = await prisma.corpus_collection_questionnaire_profiles.findUnique({ where: { user_id: userId } });
    return {
      completed: true,
      registrationType: journey.registration_type,
      profileCompletedAt: (profile?.completed_at ?? journey.completed_at)?.toISOString(),
      contact: { status: "verified", maskedPhoneNumber: maskPhone(journey.user.phoneNumber) },
      nextAction: "show_success",
    };
  }
  if (journey.flow_type === "full_questionnaire" && !input.answers) {
    throw new QuestionnaireError("QUESTIONNAIRE_VALIDATION_FAILED", 400, "请完成必填题目");
  }
  if (
    journey.flow_type === "full_questionnaire" &&
    input.schemaVersion !== undefined &&
    input.schemaVersion !== journey.schema_version
  ) {
    throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "问卷版本与当前参赛旅程不一致");
  }
  if (journey.flow_type !== "full_questionnaire" && input.answers) {
    throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "资料复用流程不能覆盖问卷答案");
  }
  const validatedAnswers = journey.flow_type === "full_questionnaire"
    ? validateQuestionnaireAnswers(
        await getQuestionnaireDefinitionByVersion(journey.schema_version!),
        input.answers!,
      )
    : null;
  const now = new Date();
  const profile = await prisma.$transaction(async (tx) => {
    const savedProfile = journey.flow_type === "full_questionnaire"
      ? await tx.corpus_collection_questionnaire_profiles.create({
          data: {
            user_id: userId,
            schema_version: journey.schema_version!,
            age_range: validatedAnswers!.ageRange,
            culture_region: validatedAnswers!.cultureRegion,
            interest_types: validatedAnswers!.interestTypes as Prisma.InputJsonValue,
            source_activity_id: journey.activity_id,
            completed_at: now,
          },
        })
      : await tx.corpus_collection_questionnaire_profiles.findUnique({ where: { user_id: userId } });
    if (!savedProfile) throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "问卷档案不存在");
    await tx.corpus_collection_questionnaire_journeys.update({
      where: { id: journey.id },
      data: { status: "completed", completed_at: now },
    });
    await tx.corpus_collection_questionnaire_events.create({
      data: {
        event_id: crypto.randomUUID(),
        journey_id: journey.id,
        user_id: userId,
        activity_id: journey.activity_id,
        event_name: "complete_questionnaire",
        flow_type: journey.flow_type,
      },
    });
    await tx.corpus_collection_questionnaire_events.create({
      data: {
        event_id: crypto.randomUUID(),
        journey_id: journey.id,
        user_id: userId,
        activity_id: journey.activity_id,
        event_name: "questionnaire_submit_success",
        flow_type: journey.flow_type,
      },
    });
    return savedProfile;
  });
  return {
    completed: true,
    registrationType: journey.registration_type,
    profileCompletedAt: profile.completed_at.toISOString(),
    contact: { status: "verified", maskedPhoneNumber: maskPhone(journey.user.phoneNumber) },
    nextAction: "show_success",
  };
}

export async function enterQuestionnaireSubmission(
  userId: string,
  input: { journeyId: string; clientEventId: string },
) {
  const journey = await prisma.corpus_collection_questionnaire_journeys.findFirst({
    where: { id: input.journeyId, user_id: userId },
    include: {
      user: { select: { phoneNumber: true } },
      activity: { select: { status: true, starts_at: true, ends_at: true } },
    },
  });
  if (!journey) throw new QuestionnaireError("QUESTIONNAIRE_REQUIRED", 403, "请先完成参赛前登记");
  assertJourneyActive(journey);
  if (journey.activity) assertQuestionnaireActivitySubmittable(journey.activity);
  const profile = await prisma.corpus_collection_questionnaire_profiles.findUnique({ where: { user_id: userId } });
  if (!profile || !journey.user.phoneNumber || !["completed", "entered_submission"].includes(journey.status)) {
    throw new QuestionnaireError("QUESTIONNAIRE_REQUIRED", 403, "请先完成参赛前登记");
  }
  const existingEvent = await prisma.corpus_collection_questionnaire_events.findUnique({
    where: { event_id: input.clientEventId },
  });
  if (
    existingEvent &&
    (existingEvent.journey_id !== journey.id ||
      existingEvent.user_id !== userId ||
      existingEvent.event_name !== "enter_submission_page")
  ) {
    throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "事件幂等键已用于其他操作");
  }
  await prisma.$transaction([
    prisma.corpus_collection_questionnaire_journeys.update({
      where: { id: journey.id },
      data: { status: "entered_submission", entered_submission_at: new Date() },
    }),
    prisma.corpus_collection_questionnaire_events.upsert({
      where: { event_id: input.clientEventId },
      create: {
        event_id: input.clientEventId,
        journey_id: journey.id,
        user_id: userId,
        activity_id: journey.activity_id,
        event_name: "enter_submission_page",
        flow_type: journey.flow_type,
      },
      update: {},
    }),
  ]);
  return {
    allowed: true,
    activityId: journey.activity_id?.toString() ?? null,
    questionnaireJourneyId: journey.id,
    expiresAt: journey.expires_at.toISOString(),
    nextAction: "open_submission_page",
  };
}

export async function resolveQuestionnaireSubmissionJourney(
  tx: Prisma.TransactionClient,
  userId: string,
  activityId: bigint | null,
  journeyId?: string,
) {
  if (journeyId !== undefined) {
    if (!UUID_PATTERN.test(journeyId)) {
      throw new QuestionnaireError("QUESTIONNAIRE_REQUIRED", 403, "参赛旅程无效");
    }
    const journey = await tx.corpus_collection_questionnaire_journeys.findFirst({
      where: { id: journeyId, user_id: userId, activity_id: activityId },
    });
    if (!journey || journey.status !== "entered_submission") {
      throw new QuestionnaireError("QUESTIONNAIRE_REQUIRED", 403, "参赛旅程无效");
    }
    assertJourneyActive(journey);
    return journey;
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      phoneNumber: true,
      questionnaireProfile: { select: { id: true } },
    },
  });
  if (!user?.questionnaireProfile || !user.phoneNumber) {
    throw new QuestionnaireError("QUESTIONNAIRE_REQUIRED", 403, "请先完成参赛前登记");
  }

  const now = new Date();
  const existingJourney = await tx.corpus_collection_questionnaire_journeys.findFirst({
    where: {
      user_id: userId,
      activity_id: activityId,
      flow_type: "reused",
      status: "entered_submission",
      submission_id: null,
      expires_at: { gt: now },
    },
    orderBy: { started_at: "desc" },
  });
  if (existingJourney) return existingJourney;

  return tx.corpus_collection_questionnaire_journeys.create({
    data: {
      entry_client_event_id: crypto.randomUUID(),
      user_id: userId,
      activity_id: activityId,
      flow_type: "reused",
      registration_type: "reused",
      status: "entered_submission",
      completed_at: now,
      entered_submission_at: null,
      expires_at: new Date(now.getTime() + JOURNEY_TTL_MS),
    },
  });
}

export async function recordQuestionnairePhoneSubmitFailure(
  userId: string,
  journeyId: string,
  error: unknown,
) {
  if (error instanceof QuestionnaireError && error.code === "MERGE_REQUIRED") return false;
  if (!UUID_PATTERN.test(journeyId)) return false;

  const journey = await prisma.corpus_collection_questionnaire_journeys.findFirst({
    where: { id: journeyId, user_id: userId },
    select: { id: true, activity_id: true, flow_type: true },
  });
  if (!journey) return false;

  await prisma.corpus_collection_questionnaire_events.create({
    data: {
      event_id: crypto.randomUUID(),
      journey_id: journey.id,
      user_id: userId,
      activity_id: journey.activity_id,
      event_name: "phone_submit_fail",
      flow_type: journey.flow_type,
      metadata: {
        errorCode: error instanceof QuestionnaireError ? error.code : "INTERNAL_ERROR",
        stage: "phone_binding",
      },
    },
  });
  return true;
}

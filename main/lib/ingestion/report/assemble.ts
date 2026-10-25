import {
  type RawReportInput,
  REPORT_SCHEMA_VERSION,
  type ReportChange,
  type ReportDecision,
  type ReportInputFile,
  type ReportIssue,
  type ReportKind,
  type ReportRecord,
  type ReportV1,
} from "./types";

/** 宿主每轮自动写的检查点，没有内容 */
const ROUTINE_CHECKPOINTS = new Set(["Agent 单轮已提交"]);

/** 进入「AI 存疑、人工确认或修正」一节的变动 */
export const isAttention = (c: { origin: string; kind: string }) =>
  c.origin === "ai_flagged_human_confirmed" ||
  c.origin === "human_rejected_ai" ||
  c.kind === "flagged_unchanged";

const count = (values: string[]) =>
  values.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** 把系统记录组装成报告；纯函数，同样的输入得到同样的报告（generatedAt 除外） */
export function assembleReport(
  raw: RawReportInput,
  opts: { kind: ReportKind; version: number; now?: Date },
): ReportV1 {
  const ops = [...raw.operations].sort((a, b) => a.committedAt.localeCompare(b.committedAt));
  const insertOps = ops.filter((o) => o.records);
  const lineage =
    !ops.length || ops.every((o) => !o.changes)
      ? "none"
      : ops.every((o) => o.changes && o.manifest)
        ? "full"
        : "partial";

  /* 决策：一组提问为 q-<n>，组内多题为 q-<n>.<k> */
  const decisions: ReportDecision[] = [];
  const decisionByRef = new Map<string, string>();
  [...raw.questions]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((group, g) => {
      const ids = group.questions.map((_, k) =>
        group.questions.length === 1 ? `q-${g + 1}` : `q-${g + 1}.${k + 1}`,
      );
      group.questions.forEach((q, k) => {
        const answer = group.answers?.find((a) => a.question_id === (q.id ?? `q${k + 1}`));
        decisions.push({
          id: ids[k],
          groupId: group.id,
          header: q.header,
          question: q.question,
          options: q.options.map((o) => o.label),
          selected: answer?.selected ?? [],
          other: answer?.other ?? null,
          status: group.status,
          askedAt: group.createdAt,
          answeredAt: group.resolvedAt,
          affects: [],
        });
        decisionByRef.set(`${group.id}#${q.id ?? `q${k + 1}`}`, ids[k]);
      });
      for (const key of [group.id, group.toolCallId, ids[0]]) decisionByRef.set(key, ids[0]);
    });
  const decisionOf = (ref: { question_id?: string } | undefined) =>
    (ref?.question_id && decisionByRef.get(ref.question_id)) || null;
  const affect = (decisionId: string | null, ref: string) => {
    const d = decisionId && decisions.find((x) => x.id === decisionId);
    if (d && !d.affects.includes(ref)) d.affects.push(ref);
  };

  /* 语料 */
  const records: ReportRecord[] = [];
  for (const op of insertOps) {
    const created = new Map(op.created.map((c) => [c.row, c.corpusId]));
    const skipped = new Map(
      ((obj(op.result).skipped as { row: number; existing_id: number | string }[] | undefined) ?? []).map(
        (s) => [s.row, String(s.existing_id)],
      ),
    );
    for (const r of op.records ?? []) {
      const corpusId = created.get(r.row) ?? null;
      const existingId = skipped.get(r.row) ?? null;
      records.push({
        id: `r-${records.length + 1}`,
        operationId: op.id,
        row: r.row,
        status: corpusId ? "inserted" : existingId ? "skipped" : "unknown",
        corpusId,
        existingId,
        data: r.data,
        category: r.links?.category ?? null,
        tags: r.links?.tags ?? [],
        sources: r.sources ?? [],
      });
    }
  }
  // records 文件读不到时，至少列出已入库的语料
  for (const op of ops.filter((o) => !o.records)) {
    for (const c of op.created)
      records.push({
        id: `r-${records.length + 1}`,
        operationId: op.id,
        row: c.row,
        status: "inserted",
        corpusId: c.corpusId,
        existingId: null,
        data: "",
        category: null,
        tags: [],
        sources: [],
      });
  }

  /* 变动 */
  const withChanges = ops.filter((o) => o.changes?.length);
  const changes: ReportChange[] = withChanges.flatMap((op, i) =>
    op.changes!.map(({ change_id, ...c }) => {
      const id = withChanges.length === 1 ? change_id : change_id.replace(/^c-/, `c${i + 1}-`);
      const decisionId = decisionOf(c.decision_ref);
      affect(decisionId, id);
      return { ...c, id, operationId: op.id, attention: isAttention(c), decisionId };
    }),
  );

  /* 原始文件：上传记录 + 最后一次 build_records 的文件清单 */
  const manifestByPath = new Map(
    ops.flatMap((o) => o.manifest ?? []).map((m) => [m.path, m] as const),
  );
  const paths = [...new Set([...raw.files.map((f) => f.path), ...manifestByPath.keys()])].sort();
  const inputs: ReportInputFile[] = paths.map((path, i) => {
    const upload = raw.files.find((f) => f.path === path);
    const m = manifestByPath.get(path);
    const id = `f-${i + 1}`;
    for (const d of m?.discarded ?? []) affect(decisionOf(d.decision_ref), id);
    return {
      id,
      name: upload?.name ?? path.split("/").pop() ?? path,
      uploadStatus: upload?.status ?? "unknown",
      untracked: !m,
      path,
      size: m?.size ?? upload?.size,
      handling: m?.handling ?? "unknown",
      ops: m?.ops ?? [],
      artifacts: m?.artifacts ?? [],
      records: m?.records ?? 0,
      discarded: m?.discarded ?? [],
      uncovered: m?.uncovered ?? [],
      uncovered_total: m?.uncovered_total ?? 0,
      ...(m?.duration ? { duration: m.duration } : {}),
      note: m?.note ?? "",
    };
  });

  /* 提案与组织变化 */
  const approvals = [...raw.approvals].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const approved = approvals.filter((a) => a.status === "approved");
  const registered = approved.find((a) => a.kind === "register_corpus");
  const uploads = approved.filter((a) => a.kind === "upload_audio").map((a) => obj(a.result));

  /* 遗留问题 */
  const issues: Omit<ReportIssue, "id">[] = [];
  for (const c of changes) {
    if (c.origin !== "unexplained") continue;
    issues.push(
      c.kind === "flagged_unchanged"
        ? { kind: "flagged_unresolved", detail: `工具标为存疑，未见人工结论（${c.facet}）`, refs: [c.id] }
        : { kind: "unexplained_change", detail: `变动未说明来由（${c.facet}，${c.kind}）`, refs: [c.id] },
    );
  }
  for (const f of inputs) {
    const open = f.uncovered.filter((u) => !u.reason).length;
    if (f.uncovered_total && open)
      issues.push({ kind: "uncovered_input", detail: `${f.uncovered_total} 处未入库也未说明丢弃原因`, refs: [f.id] });
    if (f.untracked && lineage !== "none" && f.uploadStatus !== "UPLOADING")
      issues.push({ kind: "unprocessed_file", detail: "来源追溯中没有该文件的处理记录", refs: [f.id] });
  }
  const untraced = records.filter((r) =>
    r.sources.some((s) => !s.generated && !s.anchors?.length),
  );
  if (lineage !== "none" && untraced.length)
    issues.push({
      kind: "unresolved_source",
      detail: `${untraced.length} 条语料有部分内容找不到原文件位置`,
      refs: untraced.slice(0, 50).map((r) => r.id),
    });
  if (lineage === "none" && ops.length)
    issues.push({ kind: "no_lineage", detail: "本任务入库时没有来源追溯记录，无法对照原文件", refs: [] });
  const unchecked = ops.reduce((n, o) => n + (o.unchecked ?? 0), 0);
  if (unchecked)
    issues.push({
      kind: "unchecked_changes",
      detail: `${unchecked} 处内容来自原始文件，但找不到可对照的原值，和原文相比改了什么没有记录`,
      refs: [],
    });
  const unknown = records.filter((r) => r.status === "unknown");
  if (unknown.length)
    issues.push({
      kind: "unknown_records",
      detail: `${unknown.length} 条记录既不在入库凭据中、也不在去重跳过清单中`,
      refs: unknown.slice(0, 50).map((r) => r.id),
    });
  const operations = approvals.map((a, i) => ({
    id: `p-${i + 1}`,
    approvalId: a.id,
    proposalId: a.proposalId,
    kind: a.kind,
    summary: a.summary,
    status: a.status,
    expected: a.expected,
    decidedBy: a.decidedBy,
    decidedAt: a.decidedAt,
    decisionNote: a.decisionNote,
    createdAt: a.createdAt,
  }));
  // 计划的各步共享一个审批，失败只记一次；之后同类步骤已执行成功的不算遗留
  for (const p of operations.filter(
    (o, i, all) =>
      o.status === "failed" &&
      all.findIndex((x) => x.approvalId === o.approvalId) === i &&
      !all.some((x, j) => j > i && x.kind === o.kind && x.status === "approved"),
  ))
    issues.push({ kind: "failed_proposal", detail: `提案执行失败：${p.summary ?? p.kind}`, refs: [p.id] });
  const openIssues = issues.map((x, i) => ({ id: `i-${i + 1}`, ...x }));

  const inserted = records.filter((r) => r.status === "inserted");
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    meta: {
      kind: opts.kind,
      version: opts.version,
      generatedAt: (opts.now ?? new Date()).toISOString(),
      task: raw.task,
      lineage,
      sourceFiles: ops.map((o) => ({
        operationId: o.id,
        recordsPath: o.recordsPath,
        recordsHash: o.recordsHash,
      })),
    },
    summary: {
      inputFiles: inputs.length,
      inserted: inserted.length,
      skipped: records.filter((r) => r.status === "skipped").length,
      unknown: unknown.length,
      publishedMedia: uploads.reduce((n, u) => n + num(u.uploaded), 0),
      reusedMedia: uploads.reduce((n, u) => n + num(u.reused), 0),
      changes: changes.length,
      changesByKind: count(changes.map((c) => c.kind)),
      changesByOrigin: count(changes.map((c) => c.origin)),
      attention: changes.filter((c) => c.attention).length,
      unexplained: changes.filter((c) => c.origin === "unexplained").length,
      discarded: inputs.reduce((n, f) => n + f.discarded.length, 0),
      decisions: decisions.length,
      proposals: operations.length,
      deniedProposals: operations.filter((o) => o.status === "denied").length,
      failedProposals: operations.filter((o) => o.status === "failed").length,
      openIssues: openIssues.length,
      byCategory: count(inserted.flatMap((r) => (r.category ? [r.category] : []))),
      byTag: count(inserted.flatMap((r) => r.tags)),
    },
    inputs,
    organization: {
      dataset: {
        name: raw.task.targetDatasetName,
        ingestionType: raw.task.targetIngestionType,
        contentAttribute: raw.task.targetContentAttribute,
        registered: registered
          ? {
              name: registered.input.name as string | undefined,
              nickname: registered.input.nickname as string | undefined,
              description: registered.input.description as string | undefined,
            }
          : null,
      },
      newCategories: approved
        .filter((a) => a.kind === "new_category")
        .map((a) => ({
          slug: String(a.input.slug ?? ""),
          name: String(a.input.name ?? ""),
          parent: (a.input.parent_slug as string | undefined) ?? null,
          approvalId: a.id,
        })),
      newTags: approved
        .filter((a) => a.kind === "new_tags")
        .flatMap((a) =>
          ((a.input.tags as Record<string, string>[] | undefined) ?? []).map((t) => ({
            slug: t.slug,
            name: t.name,
            facet: t.facet,
            gloss: t.gloss,
            approvalId: a.id,
          })),
        ),
    },
    operations,
    records,
    changes,
    decisions,
    openIssues,
    checkpoints: raw.checkpoints
      .filter((c) => !ROUTINE_CHECKPOINTS.has(c.summary))
      .sort((a, b) => a.at.localeCompare(b.at)),
  };
}

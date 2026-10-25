import type { ReportV1 } from "./types";

/** LLM 输入上限（字符）；中文约一字一 token */
export const DIGEST_MAX_CHARS = 40_000;

/** 报告中可被 {{key}} 引用的数字 */
export function reportNumbers(report: ReportV1): Record<string, number> {
  const s = report.summary;
  const n: Record<string, number> = {
    input_files: s.inputFiles,
    inserted: s.inserted,
    skipped: s.skipped,
    unknown: s.unknown,
    published_media: s.publishedMedia,
    reused_media: s.reusedMedia,
    changes: s.changes,
    attention: s.attention,
    unexplained: s.unexplained,
    discarded: s.discarded,
    decisions: s.decisions,
    proposals: s.proposals,
    denied_proposals: s.deniedProposals,
    failed_proposals: s.failedProposals,
    open_issues: s.openIssues,
    new_categories: report.organization.newCategories.length,
    new_tags: report.organization.newTags.length,
  };
  for (const [k, v] of Object.entries(s.changesByKind)) n[`kind.${k}`] = v;
  for (const [k, v] of Object.entries(s.changesByOrigin)) n[`origin.${k}`] = v;
  for (const [k, v] of Object.entries(s.byCategory)) n[`category.${k}`] = v;
  for (const [k, v] of Object.entries(s.byTag)) n[`tag.${k}`] = v;
  for (const f of report.inputs) {
    n[`${f.id}.records`] = f.records;
    n[`${f.id}.artifacts`] = f.artifacts.length;
    n[`${f.id}.discarded`] = f.discarded.length;
    n[`${f.id}.uncovered`] = f.uncovered_total;
  }
  return n;
}

/** 报告内所有可引用编号 */
export function reportRefs(report: ReportV1) {
  return new Set([
    ...report.inputs.map((f) => f.id),
    ...report.changes.map((c) => c.id),
    ...report.decisions.map((d) => d.id),
    ...report.openIssues.map((i) => i.id),
    ...report.operations.map((p) => p.id),
    ...report.records.map((r) => r.id),
  ]);
}

const clip = (s: string | undefined | null, max: number) =>
  !s ? "" : s.length > max ? `${s.slice(0, max)}…` : s;

/** 有上限的 LLM 输入：统计全量；存疑项与遗留问题逐条；其余变动按类型聚合并给示例 */
export function buildDigest(report: ReportV1, maxChars = DIGEST_MAX_CHARS) {
  const build = (level: number) => {
    const examples = [3, 1, 1, 0][level];
    const textMax = [200, 120, 60, 40][level];
    const attention = report.changes.filter((c) => c.attention);
    const groups = new Map<string, typeof report.changes>();
    for (const c of report.changes.filter((c) => !c.attention)) {
      const key = `${c.kind}/${c.origin}`;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return {
      task: {
        title: report.meta.task.title,
        description: clip(report.meta.task.description, textMax * 3),
        status: report.meta.task.status,
        dataset: report.organization.dataset,
        modalities: report.meta.task.modalities,
        lineage: report.meta.lineage,
      },
      numbers: reportNumbers(report),
      files: report.inputs.map((f) => ({
        id: f.id,
        path: f.path,
        handling: f.handling,
        ops: f.ops,
        discarded_reasons: [...new Set(f.discarded.map((d) => d.reason))].slice(0, 10),
        has_uncovered: f.uncovered_total > 0,
        note: clip(f.note, textMax),
        untracked: f.untracked,
      })),
      organization: {
        new_categories: report.organization.newCategories,
        new_tags: report.organization.newTags.map((t) => ({ ...t, gloss: clip(t.gloss, textMax) })),
      },
      attention_changes: attention.slice(0, level === 3 ? 200 : undefined).map((c) => ({
        id: c.id,
        src: c.src,
        facet: c.facet,
        kind: c.kind,
        origin: c.origin,
        before: clip(c.before, textMax),
        after: clip(c.after, textMax),
        evidence: c.evidence,
        decision: c.decisionId,
        note: clip(c.note, textMax),
      })),
      other_changes: [...groups].map(([key, list]) => {
        const [kind, origin] = key.split("/");
        return {
          kind,
          origin,
          count_key: `kind.${kind}`,
          examples: list.slice(0, examples).map((c) => ({
            id: c.id,
            before: clip(c.before, textMax),
            after: clip(c.after, textMax),
            note: clip(c.note, textMax),
          })),
        };
      }),
      decisions: report.decisions.map((d) => ({
        id: d.id,
        question: clip(d.question, textMax),
        selected: d.selected,
        other: clip(d.other, textMax),
        status: d.status,
        affects: d.affects.slice(0, 10),
      })),
      proposals: report.operations.map((p) => ({
        id: p.id,
        kind: p.kind,
        summary: clip(p.summary, textMax),
        status: p.status,
        note: clip(p.decisionNote, textMax),
      })),
      open_issues: report.openIssues.map((i) => ({ ...i, refs: i.refs.slice(0, 10) })),
      stages: report.checkpoints
        .slice(-[40, 20, 10, 5][level])
        .map((c) => clip(c.summary, textMax * 2)),
    };
  };
  let digest = build(0);
  for (let level = 1; level <= 3 && JSON.stringify(digest).length > maxChars; level++)
    digest = build(level);
  return digest;
}

export type Digest = ReturnType<typeof buildDigest>;

import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import { assembleReport } from "./assemble";
import { buildDigest, requiredRefs } from "./digest";
import { lineagePathsOf, parseJsonl } from "./load";
import { parseJsonObject, writeNarrative } from "./narrative";
import { describeAnchor, renderMarkdown } from "./render-md";
import { renderXlsx } from "./render-xlsx";
import type { LineageChange, RawReportInput } from "./types";
import { type Narrative, validateNarrative } from "./validate";

const xlsx = "input/清单.xlsx";
const row = (n: number) => `${xlsx}#sheet=S&row=${n}`;

function fixture(): RawReportInput {
  const changes: LineageChange[] = [
    { change_id: "c-0001", row: 1, src: row(4), facet: "jyutping", field: "structured_note.data[0].jyutping", before: "", after: "cong4 cin4", kind: "jyutping_generated", origin: "rule", evidence: { tool: "annotate" } },
    { change_id: "c-0002", row: 1, src: row(4), facet: "jyutping", field: "structured_note.data[0].jyutping", before: "cong4 cin4", after: "cong1 cin4", kind: "jyutping_fix", origin: "ai_flagged_human_confirmed", evidence: { flags: "多音字:床" }, decision_ref: { question_id: "qg-1" }, note: "用户确认" },
    { change_id: "c-0003", row: 2, src: row(5), facet: "data", field: "data", before: "疑是地上霜", after: "疑是地上霜。", kind: "punctuation", origin: "unexplained" },
    { change_id: "c-0004", row: 2, segment_id: "朗诵#L3", facet: "audio", field: "audio.segment", before: "6.00–9.00", after: "6.20–9.10", kind: "segment_boundary", origin: "human_override" },
  ];
  return {
    task: {
      id: "7", taskNo: "IT-0007", title: "静夜思朗诵", description: "测试", status: "COMPLETED",
      targetDatasetName: "dbl", targetIngestionType: "new_dataset", targetContentAttribute: "oral",
      modalities: ["text", "audio"], assignee: "负责人", creator: "创建人",
      createdAt: "2026-10-24T01:00:00.000Z", completedAt: "2026-10-24T05:00:00.000Z", cancelledAt: null,
    },
    files: [
      { path: xlsx, name: "清单.xlsx", size: 2048, status: "UPLOADED" },
      { path: "input/朗诵.wav", name: "朗诵.wav", size: 4_000_000, status: "UPLOADED" },
      { path: "input/备注.txt", name: "备注.txt", size: 10, status: "UPLOADED" },
    ],
    approvals: [
      { id: "ap-1", proposalId: "pr-1", kind: "register_corpus", summary: "登记 dbl", input: { nickname: "朗诵" }, status: "approved", expected: {}, result: {}, decidedBy: "审批人", decidedAt: "2026-10-24T02:00:00.000Z", decisionNote: null, createdAt: "2026-10-24T02:00:00.000Z" },
      { id: "ap-2", proposalId: "pr-2", kind: "upload_audio", summary: "上传 3 个音频", input: {}, status: "approved", expected: { objects: 3, reused: 0 }, result: {}, decidedBy: "审批人", decidedAt: "2026-10-24T03:00:00.000Z", decisionNote: null, createdAt: "2026-10-24T03:00:00.000Z" },
      { id: "ap-3", proposalId: "pr-3", kind: "insert_records", summary: "插入 2 条", input: { records: "output/records.jsonl" }, status: "approved", expected: {}, result: {}, decidedBy: "审批人", decidedAt: "2026-10-24T04:00:00.000Z", decisionNote: "ok", createdAt: "2026-10-24T04:00:00.000Z" },
    ],
    operations: [
      {
        id: "op-1", approvalId: "ap-3", proposalId: "pr-3", recordsPath: "output/records.jsonl", recordsHash: "abcdef0123456789",
        committedAt: "2026-10-24T04:01:00.000Z", approvedBy: "审批人",
        result: { ids: [{ id: 101, row: 1 }], skipped: [{ row: 3, dedupe: "x", existing_id: 55 }] },
        created: [{ corpusId: "101", row: 1 }],
        records: [
          { row: 1, data: "床前明月光", category: "dbl", links: { category: "verse-poem", tags: ["media-audio"] }, sources: [{ facet: "data", anchors: [row(4)] }] },
          { row: 2, data: "疑是地上霜。", category: "dbl", links: { category: "verse-poem", tags: ["media-audio"] }, sources: [{ facet: "data", anchors: [row(5)] }] },
          { row: 3, data: "举头望明月", category: "dbl", links: { category: "verse-poem", tags: [] }, sources: [{ facet: "data", anchors: [row(6)] }] },
        ],
        changes,
        manifest: [
          { path: xlsx, handling: "parsed", ops: ["convert"], artifacts: ["work/q-v1.csv"], records: 3, discarded: [], uncovered: [{ anchor: row(8), reason: null }], uncovered_total: 1, note: "" },
          { path: "input/朗诵.wav", handling: "split", ops: ["align"], artifacts: ["work/align"], records: 3, discarded: [{ anchor: "input/朗诵.wav#t=0.00,3.00", reason: "诗题", decision_ref: { question_id: "qg-1" } }], uncovered: [], uncovered_total: 0, duration: 14, note: "" },
        ],
      },
    ],
    questions: [
      {
        id: "qg-1", toolCallId: "tc-1", status: "answered",
        questions: [{ id: "q1", header: "读音", question: "床读 cong4 还是 cong1？", options: [{ label: "cong4" }, { label: "cong1" }] }],
        answers: [{ question_id: "q1", selected: ["cong1"] }],
        createdAt: "2026-10-24T02:30:00.000Z", resolvedAt: "2026-10-24T02:40:00.000Z",
      },
    ],
    checkpoints: [{ at: "2026-10-24T02:10:00.000Z", summary: "表格转换完成" }],
  };
}

const report = () => assembleReport(fixture(), { kind: "final", version: 1, now: new Date("2026-10-24T06:00:00Z") });

const goodNarrative = (): Narrative => ({
  overview: "本批入库 {{inserted}} 条，跳过 {{skipped}} 条，主要文件为 [f-3]。",
  files: "[f-2] 按句切分，片头诗题按 [q-1] 丢弃。",
  organization: "新建语料集。",
  changes: "以自动注音为主，共 {{kind.jyutping_generated}} 处。",
  attention: "[c-0002] 多音字由人确认。",
  decisions: "[q-1] 确定了读音。",
  issues: "[i-1] 需补充说明；[i-2] 确认是否需要处理；[i-3] 需确认未覆盖的行；[i-4] 需核对入库凭据。",
});

test("assembles records, decisions and open issues from system records", () => {
  const r = report();
  assert.equal(r.meta.lineage, "full");
  assert.deepEqual(
    r.records.map((x) => [x.row, x.status, x.corpusId ?? x.existingId]),
    [[1, "inserted", "101"], [2, "unknown", null], [3, "skipped", "55"]],
  );
  assert.equal(r.summary.inserted, 1);
  assert.equal(r.summary.publishedMedia, 3);
  assert.deepEqual(r.changes.filter((c) => c.attention).map((c) => c.id), ["c-0002"]);
  assert.equal(r.changes[1].decisionId, "q-1");
  assert.deepEqual(r.decisions[0].affects.sort(), ["c-0002", "f-2"]);
  assert.equal(r.decisions[0].selected[0], "cong1");
  // 备注.txt 上传了但来源追溯中没有处理记录
  assert.equal(r.inputs.find((f) => f.path === "input/备注.txt")?.untracked, true);
  assert.deepEqual(
    r.openIssues.map((i) => i.kind),
    ["unexplained_change", "unprocessed_file", "uncovered_input", "unknown_records"],
  );
  assert.equal(r.organization.dataset.registered?.nickname, "朗诵");
});

test("prefixes change ids per operation when a task inserts more than once", () => {
  const raw = fixture();
  raw.operations.push({ ...raw.operations[0], id: "op-2", committedAt: "2026-10-24T04:30:00.000Z", created: [] });
  const r = assembleReport(raw, { kind: "final", version: 1 });
  assert.equal(new Set(r.changes.map((c) => c.id)).size, r.changes.length);
  assert.ok(r.changes.some((c) => c.id === "c2-0001"));
});

test("degrades gracefully for batches without lineage", () => {
  const raw = fixture();
  raw.operations[0] = { ...raw.operations[0], records: null, changes: null, manifest: null };
  const r = assembleReport(raw, { kind: "final", version: 1 });
  assert.equal(r.meta.lineage, "none");
  assert.equal(r.records.length, 1);
  assert.ok(r.openIssues.some((i) => i.kind === "no_lineage"));
  assert.match(renderMarkdown(r, null), /没有来源追溯记录/);
});

test("validates narrative numbers, references and coverage", () => {
  const r = report();
  assert.deepEqual(validateNarrative(r, goodNarrative()), { ok: true, errors: [] });
  const bad = { ...goodNarrative(), overview: "本批入库 3 条，见 [c-9999]、{{nope}}。", attention: "无" };
  const { ok, errors } = validateNarrative(r, bad);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes("阿拉伯数字")));
  assert.ok(errors.some((e) => e.includes("[c-9999]")));
  assert.ok(errors.some((e) => e.includes("{{nope}}")));
  assert.ok(errors.some((e) => e.includes("[c-0002]")));
  assert.ok(!validateNarrative(r, { ...goodNarrative(), files: "## 标题" }).ok);
});

test("keeps the LLM digest within budget for large batches", () => {
  const raw = fixture();
  const many = Array.from({ length: 3000 }, (_, i): LineageChange => ({
    change_id: `c-${String(i + 10).padStart(4, "0")}`, row: 1, facet: "data", field: "data",
    before: "很长的原文".repeat(20), after: "很长的新文".repeat(20), kind: i % 2 ? "s2hk" : "text_fix",
    origin: i % 3 ? "rule" : "ai_flagged_human_confirmed",
  }));
  raw.operations[0].changes = [...raw.operations[0].changes!, ...many];
  const r = assembleReport(raw, { kind: "final", version: 1 });
  assert.ok(JSON.stringify(buildDigest(r)).length < 200_000);
  // 存疑项过多时不强制逐条引用，清单由模板全量列出
  assert.deepEqual(requiredRefs(r), []);
});

test("renders markdown with resolved narrative and the full attention list", () => {
  const md = renderMarkdown(report(), goodNarrative());
  for (const heading of ["## 一、概览", "## 二、原始文件与处理方式", "### 4.2 AI 存疑、人工确认或修正", "## 七、遗留问题"])
    assert.ok(md.includes(heading), heading);
  assert.match(md, /本批入库 1 条，跳过 1 条，主要文件为 `清单\.xlsx`/);
  assert.match(md, /`c-0002` 清单\.xlsx 「S」 第 4 行 · jyutping：`cong4 cin4` → `cong1 cin4`/);
  assert.match(md, /丢弃 朗诵\.wav 0\.00–3\.00s：诗题/);
  assert.match(renderMarkdown(report(), null, { narrativeError: "超时" }), /AI 导读未生成（超时）/);
  assert.equal(describeAnchor("input/a.xlsx#sheet=%E8%A1%A8&row=3&col=C"), "a.xlsx 「表」 第 3 行 C 列");
});

test("writes the detail workbook", () => {
  const book = XLSX.read(renderXlsx(report()), { type: "buffer" });
  assert.deepEqual(book.SheetNames, ["概览", "文件处理", "入库语料", "变动明细", "人工决策", "提案审批"]);
  const changes = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets["变动明细"]);
  assert.equal(changes.length, 4);
  assert.equal(changes[1]["来由"], "AI 存疑、人工确认");
});

test("retries the narrative once with validation errors, then falls back", async () => {
  process.env.INGESTION_REPORT_LLM_API_KEY = "test-key";
  const reply = (content: unknown) =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 });
  const bodies: string[] = [];
  const fixed = await writeNarrative(report(), (async (_: unknown, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return reply(bodies.length === 1 ? { ...goodNarrative(), overview: "入库 1 条" } : goodNarrative());
  }) as typeof fetch);
  assert.ok(fixed.narrative);
  assert.deepEqual(fixed.meta.attempts.map((a) => a.ok), [false, true]);
  assert.match(bodies[1], /阿拉伯数字/);

  const failed = await writeNarrative(report(), (async () => reply({ overview: "1" })) as typeof fetch);
  assert.equal(failed.narrative, null);
  assert.equal(failed.meta.attempts.length, 2);
  delete process.env.INGESTION_REPORT_LLM_API_KEY;
});

test("reads the narrative JSON even when the model wraps it in a code block", () => {
  assert.deepEqual(parseJsonObject('```json\n{"overview":"无"}\n```'), { overview: "无" });
  assert.equal(parseJsonObject("没有 JSON"), null);
});

test("derives lineage paths and tolerates broken jsonl lines", () => {
  assert.deepEqual(lineagePathsOf("output/records.v2.jsonl"), {
    changes: "output/records.v2.changes.jsonl",
    manifest: "output/records.v2.manifest.json",
    snapshot: "output/records.v2.lineage-snapshot.json",
  });
  assert.deepEqual(parseJsonl('{"a":1}\nnot json\n\n{"a":2}\n'), [{ a: 1 }, { a: 2 }]);
  assert.equal(parseJsonl(null), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import { blockSchema, groundBlocks, stripJyutping, type Block } from "./blocks";
import { groundingFromHistory, toModelMessages, type StoredMessage } from "./conversation";
import { startOfShanghaiDay } from "./quota";
import { balanceJson } from "./repair";
import { withPoolRetry } from "./corpus";
import { splitStreamingText, stripJyutpingTransform } from "./stream";

const grounding = () => ({
  corpusIds: new Set([1, 2, 3]),
  questionIds: new Set([10]),
});

test("groundBlocks keeps blocks whose ids were returned by tools", () => {
  const blocks: Block[] = [
    { type: "word_card", corpusId: 1 },
    { type: "example_list", corpusIds: [2, 3] },
    { type: "quiz", questionIds: [10] },
    { type: "suggestions", items: ["再来一题"] },
  ];
  const result = groundBlocks(blocks, grounding());
  assert.equal(result.blocks.length, 4);
  assert.equal(result.dropped, 0);
});

test("groundBlocks drops blocks referencing unknown ids", () => {
  const blocks: Block[] = [
    { type: "word_card", corpusId: 99 },
    { type: "example_list", corpusIds: [1, 99] },
    { type: "quiz", questionIds: [11] },
    {
      type: "compare_table",
      title: "对比",
      columns: ["粤语", "普通话"],
      rows: [{ label: "吃饭", cells: [{ corpusId: 98 }, "吃饭"] }],
    },
    { type: "word_card", corpusId: 2 },
  ];
  const result = groundBlocks(blocks, grounding());
  assert.deepEqual(result.blocks, [{ type: "word_card", corpusId: 2 }]);
  assert.equal(result.dropped, 4);
});

test("stripJyutping removes model-written jyutping but keeps prose", () => {
  assert.deepEqual(stripJyutping("「饭堂」(faan6 tong4) 即食堂"), {
    text: "「饭堂」 即食堂",
    stripped: 1,
  });
  assert.equal(stripJyutping("你好 nei5 hou2，早晨").text, "你好，早晨");
  assert.equal(stripJyutping("語氣詞，表反問，讀 me1").text, "語氣詞，表反問，");
  assert.equal(stripJyutping("「乜」（粤拼：mat1）是疑问代词").text, "「乜」是疑问代词");
  assert.deepEqual(stripJyutping("Hello, this is Cantonese 101."), {
    text: "Hello, this is Cantonese 101.",
    stripped: 0,
  });
});

test("groundBlocks strips jyutping from text blocks and drops empty ones", () => {
  const result = groundBlocks(
    [
      { type: "text", markdown: "faan6 tong4" },
      { type: "text", markdown: "食堂 sik6 tong4 系学校饭堂" },
    ],
    grounding(),
  );
  assert.deepEqual(result.blocks, [{ type: "text", markdown: "食堂 系学校饭堂" }]);
  assert.equal(result.dropped, 1);
  assert.equal(result.strippedJyutping, 2);
});

test("blockSchema rejects unknown block types and oversized lists", () => {
  assert.equal(blockSchema.safeParse({ type: "html", html: "<b>x</b>" }).success, false);
  assert.equal(
    blockSchema.safeParse({ type: "example_list", corpusIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] })
      .success,
    false,
  );
});

const row = (role: string, content: string, blocks: Block[] = []): StoredMessage => ({
  id: `${role}-${content}`,
  role,
  content,
  blocks,
  created_at: new Date(0),
});

test("history converts to model messages with block summaries", () => {
  const messages = toModelMessages([
    row("user", "饭堂点讲"),
    row("assistant", "睇下呢张卡", [
      { type: "word_card", corpusId: 1 },
      { type: "corpus_results", query: "饭堂" },
    ]),
    row("action", "第 1 题答错"),
  ]);
  assert.deepEqual(messages, [
    { role: "user", content: "饭堂点讲" },
    {
      role: "assistant",
      content: "睇下呢张卡\n[已展示组件: word_card(1); corpus_results(饭堂)]",
    },
    { role: "user", content: "[用户在组件上的操作] 第 1 题答错" },
  ]);
});

test("ids shown earlier in the conversation stay grounded", () => {
  const result = groundingFromHistory([
    row("assistant", "", [
      { type: "example_list", corpusIds: [5, 6] },
      { type: "quiz", questionIds: [42] },
    ]),
    row("user", "第二个例句点解"),
  ]);
  assert.deepEqual([...result.corpusIds], [5, 6]);
  assert.deepEqual([...result.questionIds], [42]);
});

test("quota day starts at midnight Asia/Shanghai", () => {
  // 2026-10-16 01:30 上海时间 = 2026-10-15 17:30 UTC
  assert.equal(
    startOfShanghaiDay(new Date("2026-10-15T17:30:00Z")).toISOString(),
    "2026-10-15T16:00:00.000Z",
  );
  // 2026-10-16 23:59 上海时间
  assert.equal(
    startOfShanghaiDay(new Date("2026-10-16T15:59:00Z")).toISOString(),
    "2026-10-15T16:00:00.000Z",
  );
});

test("streaming split holds back a possibly unfinished jyutping tail", () => {
  assert.deepEqual(splitStreamingText("饭堂（faan6 to"), { ready: "饭堂", pending: "（faan6 to" });
  assert.deepEqual(splitStreamingText("饭堂系"), { ready: "饭堂系", pending: "" });
});

test("stripJyutpingTransform removes jyutping split across deltas", async () => {
  const transform = stripJyutpingTransform()({ tools: {}, stopStream: () => {} });
  const parts = [
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", text: "「饭堂」（faa" },
    { type: "text-delta", id: "t", text: "n6 tong4）即食堂，\n第二行 OK" },
    { type: "text-end", id: "t" },
  ];
  const output: string[] = [];
  const writer = transform.writable.getWriter();
  const reading = (async () => {
    const reader = transform.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.type === "text-delta") output.push(value.text);
    }
  })();
  for (const part of parts) await writer.write(part as never);
  await writer.close();
  await reading;
  assert.equal(output.join(""), "「饭堂」即食堂，\n第二行 OK");
});

test("groundBlocks strips jyutping from compare_table text cells", () => {
  const result = groundBlocks(
    [
      {
        type: "compare_table",
        title: "咩 vs 乜",
        columns: ["字词", "读音", "功能"],
        rows: [{ label: "咩", cells: [{ corpusId: 1 }, "me1", "句末语气词"] }],
      },
    ],
    grounding(),
  );
  assert.deepEqual(result.blocks[0], {
    type: "compare_table",
    title: "咩 vs 乜",
    columns: ["字词", "读音", "功能"],
    rows: [{ label: "咩", cells: [{ corpusId: 1 }, "—", "句末语气词"] }],
  });
  assert.equal(result.strippedJyutping, 1);
});

test("balanceJson closes brackets the model left open", () => {
  assert.equal(
    balanceJson('{"blocks": [{"type": "suggestions", "items": ["a]b", "c"]}]'),
    '{"blocks": [{"type": "suggestions", "items": ["a]b", "c"]}]}',
  );
  assert.equal(balanceJson('{"blocks": [1, 2]}'), null, "already valid input is left to the SDK");
  assert.equal(balanceJson('{"blocks": [1, 2}'), null, "mismatched brackets are not guessed");
  assert.equal(balanceJson('{"text": "unterminated'), null);
});

test("withPoolRetry retries once on P2028 and rethrows other errors", async () => {
  let calls = 0;
  const value = await withPoolRetry(async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error("pool busy"), { code: "P2028" });
    return "ok";
  });
  assert.equal(value, "ok");
  assert.equal(calls, 2);

  let otherCalls = 0;
  await assert.rejects(
    withPoolRetry(async () => {
      otherCalls += 1;
      throw Object.assign(new Error("timeout"), { code: "P2010" });
    }),
  );
  assert.equal(otherCalls, 1);
});

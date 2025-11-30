import { loadEnvConfig } from "@next/env";
import { Role } from "@prisma/client";
import { generateMiniprogramToken } from "@/lib/miniprogram-jwt";

loadEnvConfig(process.cwd());

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface TestCase {
  name: string;
  method: HttpMethod;
  getPath: () => string | null;
  body?: unknown | (() => unknown);
}

const baseUrl = process.env.MINIPROGRAM_API_BASE ?? "http://localhost:3000";
const state = {
  taskId: process.env.MINIPROGRAM_TEST_TASK_ID,
  cancelTaskId:
    process.env.MINIPROGRAM_TEST_CANCEL_TASK_ID ??
    process.env.MINIPROGRAM_TEST_TASK_ID,
  submitTaskId:
    process.env.MINIPROGRAM_TEST_SUBMIT_TASK_ID ??
    process.env.MINIPROGRAM_TEST_TASK_ID,
};
const submitPayload = parseJson(process.env.MINIPROGRAM_TEST_SUBMIT_PAYLOAD);

const testCases: TestCase[] = [
  {
    name: "List completed tasks",
    method: "GET",
    getPath: () => "/api/miniprogram/task/completed",
  },
  {
    name: "List uncompleted tasks",
    method: "GET",
    getPath: () => "/api/miniprogram/task/uncompleted",
  },
  {
    name: "Fetch task detail",
    method: "GET",
    getPath: () =>
      state.taskId
        ? `/api/miniprogram/task/${state.taskId}`
        : null,
  },
  {
    name: "Cancel task",
    method: "POST",
    getPath: () =>
      state.cancelTaskId
        ? `/api/miniprogram/task/cancel/${state.cancelTaskId}`
        : null,
  },
  {
    name: "Submit task",
    method: "POST",
    getPath: () =>
      state.submitTaskId
        ? `/api/miniprogram/task/submit/${state.submitTaskId}`
        : null,
    body: () => submitPayload ?? { entries: ["demo-selection"] },
  },
];

async function main() {
  const results: Array<{ name: string; ok: boolean; status: number }> = [];
  const headers = await buildHeaders();

  for (const test of testCases) {
    const path = test.getPath();
    if (!path) {
      console.info(`⏭️  Skip ${test.name}（缺少 taskId，等待上一请求产出）`);
      continue;
    }

    const url = new URL(path, baseUrl);
    try {
      console.info(`\n▶️  ${test.name} -> ${url.toString()}`);
      const response = await fetch(url, {
        method: test.method,
        headers,
        body: formatBody(
          typeof test.body === "function" ? test.body() : test.body
        ),
      });

      const text = await response.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }

      if (response.ok) {
        console.info("✅ Success");
        console.dir(payload, { depth: 4 });
        applySideEffects(test.name, payload);
      } else {
        console.error(`❌ Failed (${response.status})`);
        console.dir(payload, { depth: 4 });
      }

      results.push({
        name: test.name,
        ok: response.ok,
        status: response.status,
      });
    } catch (error) {
      results.push({ name: test.name, ok: false, status: -1 });
      console.error(`🔥 ${test.name} 异常:`, error);
    }
  }

  const failed = results.filter((item) => !item.ok);
  if (failed.length > 0) {
    console.error(
      `\n❗ 有 ${failed.length} 个测试失败：`,
      failed.map((item) => `${item.name}(${item.status})`).join(", ")
    );
    process.exitCode = 1;
  } else {
    console.info("\n🎉 所有 @miniprogram 接口测试通过");
  }
}

async function buildHeaders(): Promise<Record<string, string>> {
  if (process.env.SKIP_MINIPROGRAM_AUTH === "true") {
    return {
      "Content-Type": "application/json",
    };
  }

  const token =
    process.env.MINIPROGRAM_TEST_TOKEN ??
    (await generateMiniprogramToken({
      userId: process.env.MINIPROGRAM_DEBUG_USER_ID ?? "local-debug-user",
      openId: process.env.MINIPROGRAM_DEBUG_OPEN_ID ?? "local-debug-openId",
      unionId: process.env.MINIPROGRAM_DEBUG_UNION_ID,
      role: parseRole(process.env.MINIPROGRAM_DEBUG_ROLE),
      isSystemAdmin: process.env.MINIPROGRAM_DEBUG_IS_ADMIN === "true",
    }));

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function formatBody(body?: unknown) {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === "string") {
    return body;
  }

  return JSON.stringify(body);
}

function parseJson(value?: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    console.warn("⚠️  MINIPROGRAM_TEST_SUBMIT_PAYLOAD 不是合法 JSON，已忽略");
    return undefined;
  }
}

function parseRole(raw?: string): Role {
  if (!raw) return Role.TAGGER_PARTNER;
  const upper = raw.toUpperCase();
  return (Role as Record<string, Role>)[upper] ?? Role.TAGGER_PARTNER;
}

function applySideEffects(testName: string, payload: unknown) {
  if (testName !== "List uncompleted tasks") {
    return;
  }

  if (state.taskId && state.cancelTaskId && state.submitTaskId) {
    return;
  }

  const fallbackIds = extractTaskIds(payload);
  const [firstId] = fallbackIds;

  if (!firstId) {
    console.warn("⚠️  未能从未完成任务列表中提取 taskId");
    return;
  }

  if (!state.taskId) {
    state.taskId = firstId;
    console.info(`ℹ️  设定 taskId=${firstId}`);
  }
  if (!state.cancelTaskId) {
    state.cancelTaskId = firstId;
    console.info(`ℹ️  设定 cancelTaskId=${firstId}`);
  }
  if (!state.submitTaskId) {
    state.submitTaskId = firstId;
    console.info(`ℹ️  设定 submitTaskId=${firstId}`);
  }
}

function extractTaskIds(payload: unknown): string[] {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload
      .map((item) => (typeof item === "object" && item ? (item as any).taskId : undefined))
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  if (
    typeof payload === "object" &&
    payload !== null
  ) {
    const data = (payload as any).data;
    if (Array.isArray(data)) {
      return data
        .map((item) => (typeof item === "object" && item ? (item as any).taskId : undefined))
        .filter((id): id is string => typeof id === "string" && id.length > 0);
    }
  }

  return [];
}

void main();


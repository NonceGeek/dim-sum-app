import { SignJWT } from "jose";
import { AccessError } from "@/lib/services/submission-access";
import { agentSessionHeader } from "./agent-session";

/**
 * 入库 Agent 的会话 token（HS256，与 Agent 共享 CORPUS_AGENT_SESSION_SECRET）。
 * 只对一个用户的一个任务有效；Agent 每次请求还会在库里复核权限。
 * 格式与 yue-lint-agent apps/corpus-ingest-agent/src/session-token.ts 一致。
 */
const AUDIENCE = "corpus-ingest-agent";
export const SESSION_TTL_SECONDS = 600;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export const agentBaseUrl = () =>
  requireEnv("CORPUS_AGENT_BASE_URL").replace(/\/$/, "");

export function signSessionToken(
  claims: { userId: string; taskId: string },
  ttlSeconds = SESSION_TTL_SECONDS,
  secret = requireEnv("CORPUS_AGENT_SESSION_SECRET"),
) {
  return new SignJWT({ task_id: claims.taskId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(new TextEncoder().encode(secret));
}

/** 以操作人身份调用 Agent 的任务会话接口；Agent 的错误原样转成 AccessError */
export async function callAgent<T>(
  claims: { userId: string; taskId: string },
  path: string,
  init: { method?: "GET" | "POST" } = {},
): Promise<T> {
  const token = await signSessionToken(claims, 60);
  let response: Response;
  try {
    response = await fetch(
      `${agentBaseUrl()}/v1/tasks/${encodeURIComponent(claims.taskId)}${path}`,
      {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...agentSessionHeader(claims.taskId),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch {
    throw new AccessError(503, "入库 Agent 暂不可用");
  }
  const text = await response.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok)
    throw new AccessError(
      response.status >= 500 ? 502 : response.status,
      typeof body.error === "string" ? body.error : "入库 Agent 请求失败",
    );
  return body as T;
}

/**
 * 入库 Agent 部署在 AgentRun 上，按这个请求头做会话亲和：同一任务的请求固定到一个实例，
 * 浏览器断开后 Agent 在后台继续执行期间实例也不会被回收。浏览器端与服务端都要带上。
 * 与 yue-lint-agent apps/corpus-ingest-console/src/api.ts 的 authHeaders 一致。
 */
export const agentSessionHeader = (taskId: string) => ({
  "x-corpus-session": `task-${taskId}`,
});

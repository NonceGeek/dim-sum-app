import { Prisma } from "@prisma/client";
import { assertDataset, assertScope } from "./access";
import { canCreate, type AdminAccess } from "./policy";
import { AccessError } from "./security";
/** Validate every supplied target; mixed requests cannot smuggle an unrelated activity. */
export async function assertCoverAccess(
  access: AdminAccess,
  body: Record<string, unknown>,
  db: Prisma.TransactionClient,
) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccessError(400, "参数无效");
  let targeted = false;
  if (body.datasetName !== undefined) {
    if (typeof body.datasetName !== "string" || !body.datasetName)
      throw new AccessError(400, "语料集名称无效");
    await assertDataset(access, body.datasetName, "manage", db);
    targeted = true;
  }
  for (const key of ["activityId", "submissionId"] as const) {
    if (body[key] === undefined || body[key] === null) continue;
    if (
      typeof body[key] !== "string" ||
      !/^[1-9]\d*$/.test(body[key] as string)
    )
      throw new AccessError(400, "对象 ID 无效");
    const id = BigInt(body[key] as string);
    if (key === "activityId") assertScope(access, "activity", id, "manage");
    else {
      const submission = await db.corpus_collection_submissions.findUnique({
        where: { id },
        select: { activity_id: true },
      });
      if (!submission?.activity_id)
        throw new AccessError(403, "无投稿管理权限");
      assertScope(access, "activity", submission.activity_id, "manage");
    }
    targeted = true;
  }
  if (!targeted && !canCreate(access, "activity"))
    throw new AccessError(403, "需要目标对象权限或活动创建资格");
}
/** Candidate images come from OSS. Never turn scoped cover selection into an arbitrary URL fetch. */
export function generatedCoverUrl(value: unknown) {
  if (typeof value !== "string") throw new AccessError(400, "候选图地址无效");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AccessError(400, "候选图地址无效");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !(
      url.hostname.endsWith(".aliyuncs.com") ||
      url.hostname === "alioss.aidimsum.com"
    )
  )
    throw new AccessError(400, "请选择生成服务返回的候选图");
  return url.href;
}
export async function readCoverImage(
  response: Response,
  maxBytes = 20 * 1024 * 1024,
) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^image\/(png|jpeg|webp|gif)(;|$)/i.test(contentType))
    throw new AccessError(400, "候选文件不是支持的图片");
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new AccessError(400, "候选图片过大");
  }
  if (!response.body) throw new AccessError(400, "候选图片为空");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AccessError(400, "候选图片过大");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new AccessError(400, "候选图片为空");
  return Buffer.concat(chunks);
}

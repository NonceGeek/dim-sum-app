import OSS from "ali-oss";

/**
 * 入库工作区 bucket（与入库 Agent 挂载的同一个）：签发原始文件直传 URL、确认上传，以及读写入库报告。
 * RAM 权限：batches/*\/input/* 的 oss:PutObject；batches/* 的 oss:GetObject（HeadObject 按 GetObject 鉴权，
 * 报告要读 work/ output/ audit/ proposals/）；batches/*\/report/* 的 oss:PutObject。
 * 见 yue-lint-agent apps/corpus-ingest-agent/DEPLOY.md「dim-sum-app 上传用的 RAM 用户」。
 */
let client: OSS | undefined;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function ingestOss() {
  client ??= new OSS({
    region: requireEnv("CORPUS_INGEST_OSS_REGION"),
    bucket: requireEnv("CORPUS_INGEST_OSS_BUCKET"),
    accessKeyId: requireEnv("CORPUS_INGEST_OSS_ACCESS_KEY_ID"),
    accessKeySecret: requireEnv("CORPUS_INGEST_OSS_ACCESS_KEY_SECRET"),
    secure: true,
  });
  return client;
}

export const UPLOAD_URL_TTL_SECONDS = 30 * 60;

export function uploadMaxBytes() {
  const configured = Number(process.env.CORPUS_INGEST_UPLOAD_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : 1024 ** 3;
}

/** 浏览器直传新对象；x-oss-forbid-overwrite 参与签名，保证不覆盖已有文件 */
export function signNewUpload(key: string) {
  const headers = {
    "Content-Type": "application/octet-stream",
    "x-oss-forbid-overwrite": "true",
  };
  const url = ingestOss().signatureUrl(key, {
    method: "PUT",
    expires: UPLOAD_URL_TTL_SECONDS,
    ...headers,
  } as OSS.SignatureUrlOptions);
  return { method: "PUT" as const, url, headers };
}

/** 对象不存在时返回 null */
export async function headObject(key: string) {
  try {
    const result = await ingestOss().head(key);
    const headers = result.res.headers as Record<string, string>;
    return {
      size: Number(headers["content-length"]),
      etag: headers.etag?.replaceAll('"', "") ?? null,
    };
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

/** 读文本对象；不存在时返回 null */
export async function getObjectText(key: string) {
  try {
    const result = await ingestOss().get(key);
    return Buffer.from(result.content as Buffer).toString("utf8");
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

/** 列出前缀下的对象 key（含前缀） */
export async function listObjectKeys(prefix: string) {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await ingestOss().listV2(
      { prefix, "max-keys": 1000, ...(token ? { "continuation-token": token } : {}) },
      {},
    );
    keys.push(...(page.objects ?? []).map((o) => o.name));
    token = page.isTruncated
      ? (page as { nextContinuationToken?: string }).nextContinuationToken
      : undefined;
  } while (token);
  return keys;
}

/** 写新对象，不覆盖已有文件 */
export async function putNewObject(key: string, body: string | Buffer, contentType: string) {
  await ingestOss().put(key, Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8"), {
    headers: { "Content-Type": contentType, "x-oss-forbid-overwrite": "true" },
  });
}

/** 下载用的临时 URL，带下载文件名 */
export function signDownload(key: string, filename: string, expires = 10 * 60) {
  return ingestOss().signatureUrl(key, {
    expires,
    response: {
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

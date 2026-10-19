import OSS from "ali-oss";

/**
 * 入库工作区 bucket（与入库 Agent 挂载的同一个），只用于签发原始文件直传 URL 与确认上传。
 * RAM 权限只需 batches/*\/input/* 的 PutObject / HeadObject。
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

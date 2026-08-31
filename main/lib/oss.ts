import OSS from "ali-oss";

const clients = new Map<string, OSS>();
const DEFAULT_OSS_TIMEOUT_MS = 180_000;
const ACCELERATE_ENDPOINT = "oss-accelerate.aliyuncs.com";

const OSS_BUCKET_BY_PURPOSE = {
  avatar: "dimsum-user-avatar",
  submissionMedia: "dimsum-audio",
  corpusAsset: "dimsum-user-avatar",
} as const;

const UPLOAD_RULES = {
  avatar: {
    directory: "avatars",
    maxSize: 5 * 1024 * 1024,
    allowedTypes: new Set<string>(["image/jpeg", "image/png", "image/gif", "image/webp"]),
  },
  submissionMedia: {
    directory: "tagger",
    maxSize: 100 * 1024 * 1024,
    allowedTypes: new Set<string>([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "audio/mpeg",
      "audio/mp4",
      "audio/aac",
      "audio/wav",
      "audio/x-wav",
      "audio/webm",
      "video/mp4",
      "video/quicktime",
    ]),
  },
} as const;

export type OssUploadPurpose = keyof typeof UPLOAD_RULES;
export type OssBucketPurpose = keyof typeof OSS_BUCKET_BY_PURPOSE;

export class OssUploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OssUploadValidationError";
  }
}

function getOssTimeoutMs() {
  const configured = Number(process.env.ALIYUN_OSS_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_OSS_TIMEOUT_MS;
}

// Vercel 的海外区域直连广州 OSS 会 ETIMEDOUT；开启后写入改走传输加速接入点。
// 读取侧不受影响：公开 URL 始终按常规地域域名生成，避免产生加速下载流量。
function useAccelerateEndpoint(): boolean {
  return process.env.ALIYUN_OSS_ACCELERATE?.trim() === "true";
}

function regionHost(): string {
  const region = requireOssConfig("ALIYUN_OSS_REGION").replace(/^oss-/, "");
  return `oss-${region}.aliyuncs.com`;
}

export function publicOssUrl(objectName: string, purpose: OssBucketPurpose): string {
  const bucket = OSS_BUCKET_BY_PURPOSE[purpose];
  const encodedKey = objectName.split("/").map(encodeURIComponent).join("/");
  return `https://${bucket}.${regionHost()}/${encodedKey}`;
}

export function getOssClient(purpose: OssBucketPurpose) {
  const bucket = OSS_BUCKET_BY_PURPOSE[purpose];
  const accelerate = useAccelerateEndpoint();

  const cacheKey = `${bucket}:${accelerate ? "accelerate" : "region"}`;
  const cached = clients.get(cacheKey);
  if (cached) return cached;

  const client = new OSS({
    // endpoint 优先级高于 region；ali-oss 默认 V1 签名与 host 无关，换域名不影响鉴权。
    ...(accelerate
      ? { endpoint: ACCELERATE_ENDPOINT }
      : { region: requireOssConfig("ALIYUN_OSS_REGION") }),
    accessKeyId: requireOssConfig("ALIYUN_OSS_ACCESS_KEY_ID"),
    accessKeySecret: requireOssConfig("ALIYUN_OSS_ACCESS_KEY_SECRET"),
    bucket,
    secure: true,
    timeout: getOssTimeoutMs(),
  });
  clients.set(cacheKey, client);
  return client;
}

function requireOssConfig(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function sanitizeKeySegment(value: string): string {
  const normalized = value.trim();
  if (!/^[\dA-Za-z_-]{1,128}$/.test(normalized)) {
    throw new OssUploadValidationError("Invalid upload owner");
  }
  return normalized;
}

function fileExtension(contentType: string): string {
  const extensionByContentType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
  };
  return extensionByContentType[contentType] || "bin";
}

function sanitizeFileName(fileName: string, contentType: string): string {
  const originalName = fileName.split(/[\\/]/).at(-1) || "";
  const stem = originalName.includes(".")
    ? originalName.slice(0, originalName.lastIndexOf("."))
    : originalName;
  const sanitizedStem = stem
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return `${sanitizedStem || "upload"}.${fileExtension(contentType)}`;
}

export async function uploadFileToOss(input: {
  file: Blob;
  fileName?: string | null;
  ownerId: string;
  purpose: OssUploadPurpose;
}) {
  const rule = UPLOAD_RULES[input.purpose];
  const contentType = normalizeContentType(input.file.type);

  if (!rule.allowedTypes.has(contentType)) {
    throw new OssUploadValidationError(`Unsupported file type: ${contentType}`);
  }
  if (input.file.size <= 0) {
    throw new OssUploadValidationError("File must not be empty");
  }
  if (input.file.size > rule.maxSize) {
    throw new OssUploadValidationError(
      `File size must not exceed ${Math.round(rule.maxSize / 1024 / 1024)}MB`
    );
  }

  const fallbackName =
    "name" in input.file && typeof input.file.name === "string" ? input.file.name : "upload";
  const storedFileName = sanitizeFileName(input.fileName || fallbackName, contentType);
  const objectName = [
    rule.directory,
    sanitizeKeySegment(input.ownerId),
    `${crypto.randomUUID()}-${storedFileName}`,
  ].join("/");
  const buffer = Buffer.from(await input.file.arrayBuffer());

  return uploadBufferToOss(objectName, buffer, contentType, input.purpose);
}

export async function uploadBufferToOss(
  objectName: string,
  buffer: Buffer,
  contentType: string | null | undefined,
  purpose: OssBucketPurpose
) {
  await getOssClient(purpose).put(objectName, buffer, {
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });
  // 不使用 result.url：开启加速时它会是加速域名，一旦写入数据库，
  // 之后每次读取都会额外计一份加速下载流量。
  return {
    name: objectName,
    url: publicOssUrl(objectName, purpose),
  };
}

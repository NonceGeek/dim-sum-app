import OSS from "ali-oss";

const clients = new Map<string, OSS>();
const DEFAULT_OSS_TIMEOUT_MS = 180_000;

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

export function getOssClient(purpose: OssBucketPurpose) {
  const bucket = OSS_BUCKET_BY_PURPOSE[purpose];

  const cached = clients.get(bucket);
  if (cached) return cached;

  const client = new OSS({
    region: requireOssConfig("ALIYUN_OSS_REGION"),
    accessKeyId: requireOssConfig("ALIYUN_OSS_ACCESS_KEY_ID"),
    accessKeySecret: requireOssConfig("ALIYUN_OSS_ACCESS_KEY_SECRET"),
    bucket,
    secure: true,
    timeout: getOssTimeoutMs(),
  });
  clients.set(bucket, client);
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
  const result = await getOssClient(purpose).put(objectName, buffer, {
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });
  return {
    name: objectName,
    url: result.url.replace("http://", "https://"),
  };
}

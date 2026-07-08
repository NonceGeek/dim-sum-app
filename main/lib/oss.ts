import OSS from "ali-oss";

let client: any = null;
const DEFAULT_OSS_TIMEOUT_MS = 180_000;

function getOssTimeoutMs() {
  const configured = Number(process.env.ALIYUN_OSS_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_OSS_TIMEOUT_MS;
}

export function getOssClient() {
  if (!client) {
    client = new OSS({
      region: process.env.ALIYUN_OSS_REGION,
      accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID!,
      accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET!,
      bucket: process.env.ALIYUN_OSS_BUCKET!,
      secure: true,
      timeout: getOssTimeoutMs(),
    });
  }
  return client;
}

export async function uploadBufferToOss(
  objectName: string,
  buffer: Buffer,
  contentType?: string | null
) {
  const result = await getOssClient().put(objectName, buffer, {
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });
  return {
    name: objectName,
    url: result.url.replace("http://", "https://"),
  };
}

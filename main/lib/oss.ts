import OSS from "ali-oss";

let client: any = null;

export function getOssClient() {
  if (!client) {
    client = new OSS({
      region: process.env.ALIYUN_OSS_REGION,
      accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID!,
      accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET!,
      bucket: process.env.ALIYUN_OSS_BUCKET!,
      secure: true,
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

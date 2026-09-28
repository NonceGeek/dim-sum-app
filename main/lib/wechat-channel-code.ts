export const CHANNEL_SCAN_PAGE = "pages/channel-view/channel-view";
export const CHANNEL_CODE_ENVIRONMENTS = ["release", "trial", "develop"] as const;
export type ChannelCodeEnvironment = typeof CHANNEL_CODE_ENVIRONMENTS[number];

export function channelWechatConfig() {
  const appId = process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_APPID;
  const secret = process.env.WECHAT_MINIPROGRAM_CORPUS_COLLECTION_SECRET;
  if (!appId || !secret) throw new Error("视频号扫码功能尚未配置小程序凭证");
  return { appId, secret };
}

let cached: { appId: string; secret: string; token: string; expires: number } | undefined;
async function accessToken(forceRefresh = false) {
  const { appId, secret } = channelWechatConfig();
  if (!forceRefresh && cached?.appId === appId && cached.secret === secret && cached.expires > Date.now()) return cached.token;
  const response = await fetch("https://api.weixin.qq.com/cgi-bin/stable_token", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credential", appid: appId, secret, force_refresh: forceRefresh }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`获取微信接口凭证失败（${data.errcode ?? response.status}），请检查小程序配置及服务器 IP 白名单`);
  cached = { appId, secret, token: data.access_token, expires: Date.now() + (Number(data.expires_in || 7200) - 120) * 1000 };
  return cached.token;
}

export async function generateChannelCode(scene: string, environment: ChannelCodeEnvironment, retry = true): Promise<{ bytes: Buffer; contentType: string }> {
  const token = await accessToken(!retry);
  const response = await fetch(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scene, page: CHANNEL_SCAN_PAGE, env_version: environment, check_path: environment === "release", width: 430 }),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type")?.split(";")[0];
  if (response.ok && (contentType === "image/png" || contentType === "image/jpeg")) return { bytes, contentType };
  let code: number | undefined;
  try { code = JSON.parse(bytes.toString()).errcode; } catch { /* upstream non-JSON failure */ }
  if (retry && (code === 40001 || code === 40014 || code === 42001)) return generateChannelCode(scene, environment, false);
  if (code === 41030) throw new Error("扫码页面尚未发布，请先发布小程序，或选择已上传的体验版联调");
  throw new Error(`生成小程序码失败（${code ?? response.status}），请稍后重试`);
}

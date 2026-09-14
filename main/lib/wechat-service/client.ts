import { z } from "zod";

const errorSchema = z.object({ errcode: z.number().optional() });
const infoSchema = z.object({ openid: z.string().min(1), subscribe: z.union([z.literal(0), z.literal(1)]), unionid: z.string().min(1).optional() });
const listSchema = z.object({ count: z.number().int().nonnegative(), next_openid: z.string().optional(), data: z.object({ openid: z.array(z.string().min(1)) }).optional() });
export type FollowerInfo = z.infer<typeof infoSchema>;

export class WechatServiceClient {
  private cached?: { value: string; until: number };
  constructor(private appId: string, private secret: string, private request: typeof fetch = fetch) {
    if (!appId || !secret) throw new Error("Missing service account credentials");
  }
  private async json(url: string, init?: RequestInit) {
    const response = await this.request(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`WeChat HTTP ${response.status}`);
    const json: unknown = await response.json();
    const { errcode } = errorSchema.parse(json);
    // Deliberately omit URL, token, secret and user data from errors.
    if (errcode) throw new Error(`WeChat API ${errcode}`);
    return json;
  }
  private async token() {
    if (this.cached && this.cached.until > Date.now()) return this.cached.value;
    const result = await this.json("https://api.weixin.qq.com/cgi-bin/stable_token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credential", appid: this.appId, secret: this.secret, force_refresh: false }),
    });
    const token = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).parse(result);
    this.cached = { value: token.access_token, until: Date.now() + Math.max(0, token.expires_in - 120) * 1000 };
    return token.access_token;
  }
  private async get(path: string, params: Record<string, string>) {
    for (let attempt = 0; ; attempt++) {
      const url = new URL(`https://api.weixin.qq.com/cgi-bin/${path}`);
      url.search = new URLSearchParams({ ...params, access_token: await this.token() }).toString();
      try { return await this.json(url.toString()); }
      catch (error) {
        if (attempt === 0 && error instanceof Error && /^WeChat API (40001|40014|42001)$/.test(error.message)) this.cached = undefined;
        else throw error;
      }
    }
  }
  async userInfo(openId: string) {
    const info = infoSchema.parse(await this.get("user/info", { openid: openId, lang: "zh_CN" }));
    if (info.openid !== openId) throw new Error("WeChat returned mismatched user");
    return info;
  }
  async followers(nextOpenId = "") {
    const page = listSchema.parse(await this.get("user/get", { next_openid: nextOpenId }));
    if (page.count !== (page.data?.openid.length ?? 0)) throw new Error("Invalid follower page");
    return page;
  }
}

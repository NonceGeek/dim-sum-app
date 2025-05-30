import type { OAuthConfig } from "next-auth/providers/oauth";

export interface WechatProfile {
  openid: string;
  nickname: string;
  sex: number;
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  unionid: string;
}

interface WechatOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export default function WechatProvider(
  options: WechatOptions
): OAuthConfig<WechatProfile> {
  return {
    id: "wechat",
    name: "WeChat",
    type: "oauth",
    authorization: {
      url: "https://open.weixin.qq.com/connect/qrconnect",
      params: {
        appid: options.clientId,
        response_type: "code",
        scope: "snsapi_login",
        state: "STATE",
        redirect_uri: options.redirectUri,
      },
    },
    token: {
      url: "https://api.weixin.qq.com/sns/oauth2/access_token",
      params: {
        appid: options.clientId,
        secret: options.clientSecret,
        grant_type: "authorization_code",
      },
      async request({ client, params, checks, provider }) {
        const response = await client.oauthCallback(
          provider.callbackUrl,
          params,
          checks,
          { exchangeBody: { appid: options.clientId, secret: options.clientSecret } }
        );
        return {
          tokens: response,
        };
      },
    },
    userinfo: {
      url: "https://api.weixin.qq.com/sns/userinfo",
      async request({ tokens, client }) {
        const response = await client.userinfo(tokens.access_token!, {
      params: {
            access_token: tokens.access_token,
            openid: tokens.openid,
        lang: "zh_CN",
          },
        });
        return response;
      },
    },
    profile(profile: WechatProfile) {
      return {
        id: profile.openid,
        name: profile.nickname,
        email: null,
        image: profile.headimgurl,
        openId: profile.openid,
        unionId: profile.unionid,
      };
    },
    options,
  };
} 
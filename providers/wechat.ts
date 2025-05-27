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
      url: "https://open.weixin.qq.com/connect/oauth2/authorize",
      params: {
        appid: options.clientId,
        response_type: "code",
        scope: "snsapi_userinfo",
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
    },
    userinfo: {
      url: "https://api.weixin.qq.com/sns/userinfo",
      params: {
        access_token: "ACCESS_TOKEN",
        openid: "OPENID",
        lang: "zh_CN",
      },
    },
    profile(profile: WechatProfile) {
      return {
        id: profile.openid,
        name: profile.nickname,
        email: null,
        image: profile.headimgurl,
      };
    },
    options,
  };
} 
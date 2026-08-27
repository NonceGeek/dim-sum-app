import Dysmsapi20170525, * as $Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";

const DEFAULT_SMS_ENDPOINT = "dysmsapi.aliyuncs.com";
const DEFAULT_CONNECT_TIMEOUT_MS = 4_000;
const DEFAULT_READ_TIMEOUT_MS = 6_000;
const DEFAULT_RELAY_TIMEOUT_MS = 12_000;
const SMS_RELAY_PATH = "/api/auth/sms-relay";

export type SmsSendResult = {
  success: boolean;
  message: string;
  requestId?: string;
};

function positiveIntegerFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getRelayConfiguration(): { url: string; secret: string } | null {
  const secret = process.env.ALIYUN_SMS_RELAY_SECRET?.trim();
  const explicitUrl = process.env.ALIYUN_SMS_RELAY_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const url =
    explicitUrl || (vercelUrl ? `https://${vercelUrl}${SMS_RELAY_PATH}` : "");

  if (!secret && !explicitUrl && !vercelUrl) return null;
  if (!secret || !url) {
    throw new Error("Aliyun SMS relay configuration is incomplete");
  }
  return { url, secret };
}

/** 阿里云短信服务封装。 */
export class AliyunSmsService {
  private client: Dysmsapi20170525;
  private endpoint: string;

  constructor() {
    this.endpoint =
      process.env.ALIYUN_SMS_ENDPOINT?.trim() || DEFAULT_SMS_ENDPOINT;
    const config = new $OpenApi.Config({
      accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET,
      endpoint: this.endpoint,
    });
    this.client = new Dysmsapi20170525(config);
  }

  /** 验证中国手机号格式。 */
  static isValidPhoneNumber(phoneNumber: string): boolean {
    return /^1[3-9]\d{9}$/.test(phoneNumber);
  }

  /** 格式化手机号（移除空格、-等字符）。 */
  static formatPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/[\s\-\(\)]/g, "");
  }

  /**
   * 应用 API 使用的入口。Vercel 环境通过 iad1 中转；本地开发未配置
   * 中转时保留直接调用能力。
   */
  async sendSmsCode(phoneNumber: string, code: string): Promise<SmsSendResult> {
    const formattedPhone = AliyunSmsService.formatPhoneNumber(phoneNumber);
    if (!AliyunSmsService.isValidPhoneNumber(formattedPhone)) {
      return { success: false, message: "手机号格式不正确" };
    }

    let relay: { url: string; secret: string } | null;
    try {
      relay = getRelayConfiguration();
    } catch (error) {
      console.error("阿里云短信中转配置错误", {
        region: process.env.VERCEL_REGION || "local",
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      return { success: false, message: "短信服务配置错误" };
    }

    if (!relay) return this.sendSmsCodeDirect(formattedPhone, code);
    return this.sendSmsCodeViaRelay(formattedPhone, code, relay);
  }

  /** 仅供固定在 iad1 的受保护中转 Route 调用。 */
  async sendSmsCodeDirect(
    phoneNumber: string,
    code: string,
  ): Promise<SmsSendResult> {
    const formattedPhone = AliyunSmsService.formatPhoneNumber(phoneNumber);
    if (!AliyunSmsService.isValidPhoneNumber(formattedPhone)) {
      return { success: false, message: "手机号格式不正确" };
    }

    const signName = process.env.ALIYUN_SMS_SIGN_NAME;
    const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
    if (!signName || !templateCode) {
      console.error(
        "阿里云短信配置缺失: ALIYUN_SMS_SIGN_NAME 或 ALIYUN_SMS_TEMPLATE_CODE 未设置",
      );
      return { success: false, message: "短信服务配置错误" };
    }

    const sendSmsRequest = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: formattedPhone,
      signName,
      templateCode,
      templateParam: JSON.stringify({ code }),
    });
    const runtime = new $Util.RuntimeOptions({
      // Do not retry an ambiguous response: it could send the same code twice.
      autoretry: false,
      maxAttempts: 1,
      connectTimeout: positiveIntegerFromEnv(
        "ALIYUN_SMS_CONNECT_TIMEOUT_MS",
        DEFAULT_CONNECT_TIMEOUT_MS,
      ),
      readTimeout: positiveIntegerFromEnv(
        "ALIYUN_SMS_READ_TIMEOUT_MS",
        DEFAULT_READ_TIMEOUT_MS,
      ),
    });
    const startedAt = Date.now();

    try {
      const result = await this.client.sendSmsWithOptions(sendSmsRequest, runtime);
      if (result.body.code === "OK") {
        console.info("阿里云短信发送成功", {
          endpoint: this.endpoint,
          region: process.env.VERCEL_REGION || "local",
          elapsedMs: Date.now() - startedAt,
          requestId: result.body.requestId,
        });
        return {
          success: true,
          message: "验证码发送成功",
          requestId: result.body.requestId,
        };
      }

      console.error("阿里云短信发送失败", {
        endpoint: this.endpoint,
        region: process.env.VERCEL_REGION || "local",
        elapsedMs: Date.now() - startedAt,
        code: result.body.code,
        message: result.body.message,
        requestId: result.body.requestId,
      });
      return {
        success: false,
        message: result.body.message || "短信发送失败",
        requestId: result.body.requestId,
      };
    } catch (error: unknown) {
      console.error("阿里云短信发送异常", {
        endpoint: this.endpoint,
        region: process.env.VERCEL_REGION || "local",
        elapsedMs: Date.now() - startedAt,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorCode:
          typeof error === "object" && error && "code" in error
            ? String(error.code)
            : undefined,
      });
      return { success: false, message: "短信服务暂时不可用，请稍后重试" };
    }
  }

  private async sendSmsCodeViaRelay(
    phoneNumber: string,
    code: string,
    relay: { url: string; secret: string },
  ): Promise<SmsSendResult> {
    const startedAt = Date.now();
    try {
      const response = await fetch(relay.url, {
        method: "POST",
        signal: AbortSignal.timeout(
          positiveIntegerFromEnv(
            "ALIYUN_SMS_RELAY_TIMEOUT_MS",
            DEFAULT_RELAY_TIMEOUT_MS,
          ),
        ),
        headers: {
          "Content-Type": "application/json",
          "x-aliyun-sms-relay-token": relay.secret,
        },
        body: JSON.stringify({ phoneNumber, code }),
      });
      const payload = (await response.json()) as Partial<SmsSendResult>;
      if (
        !response.ok ||
        typeof payload.success !== "boolean" ||
        typeof payload.message !== "string"
      ) {
        throw new Error(`Aliyun SMS relay failed: ${response.status}`);
      }
      console.info("阿里云短信中转调用完成", {
        region: process.env.VERCEL_REGION || "local",
        elapsedMs: Date.now() - startedAt,
        success: payload.success,
        requestId: payload.requestId,
      });
      return payload as SmsSendResult;
    } catch (error) {
      console.error("阿里云短信中转调用异常", {
        region: process.env.VERCEL_REGION || "local",
        elapsedMs: Date.now() - startedAt,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      return { success: false, message: "短信服务暂时不可用，请稍后重试" };
    }
  }
}

let smsServiceInstance: AliyunSmsService | null = null;

export function getAliyunSmsService(): AliyunSmsService {
  if (!smsServiceInstance) smsServiceInstance = new AliyunSmsService();
  return smsServiceInstance;
}

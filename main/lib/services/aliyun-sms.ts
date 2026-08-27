import Dysmsapi20170525, * as $Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";

const DEFAULT_SMS_ENDPOINT = "dysmsapi.aliyuncs.com";
const DEFAULT_CONNECT_TIMEOUT_MS = 4_000;
const DEFAULT_READ_TIMEOUT_MS = 6_000;

function positiveIntegerFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * 阿里云短信服务封装
 */
export class AliyunSmsService {
  private client: Dysmsapi20170525;
  private endpoint: string;

  constructor() {
    this.endpoint = process.env.ALIYUN_SMS_ENDPOINT?.trim() || DEFAULT_SMS_ENDPOINT;
    const config = new $OpenApi.Config({
      accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET,
      endpoint: this.endpoint,
    });
    this.client = new Dysmsapi20170525(config);
  }

  /**
   * 验证中国手机号格式
   */
  static isValidPhoneNumber(phoneNumber: string): boolean {
    // 中国大陆手机号：1开头，第二位3-9，共11位数字
    const regex = /^1[3-9]\d{9}$/;
    return regex.test(phoneNumber);
  }

  /**
   * 格式化手机号（移除空格、-等字符）
   */
  static formatPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/[\s\-\(\)]/g, "");
  }

  /**
   * 发送短信验证码
   * @param phoneNumber 手机号
   * @param code 验证码
   * @returns 发送结果
   */
  async sendSmsCode(
    phoneNumber: string,
    code: string
  ): Promise<{
    success: boolean;
    message: string;
    requestId?: string;
  }> {
    const formattedPhone = AliyunSmsService.formatPhoneNumber(phoneNumber);

    if (!AliyunSmsService.isValidPhoneNumber(formattedPhone)) {
      return {
        success: false,
        message: "手机号格式不正确",
      };
    }

    const signName = process.env.ALIYUN_SMS_SIGN_NAME;
    const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

    if (!signName || !templateCode) {
      console.error(
        "阿里云短信配置缺失: ALIYUN_SMS_SIGN_NAME 或 ALIYUN_SMS_TEMPLATE_CODE 未设置"
      );
      return {
        success: false,
        message: "短信服务配置错误",
      };
    }

    const sendSmsRequest = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: formattedPhone,
      signName: signName,
      templateCode: templateCode,
      templateParam: JSON.stringify({ code }),
    });

    const runtime = new $Util.RuntimeOptions({
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
      const result = await this.client.sendSmsWithOptions(
        sendSmsRequest,
        runtime
      );

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
      } else {
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
      }
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
      return {
        success: false,
        message: "短信服务暂时不可用，请稍后重试",
      };
    }
  }
}

// 单例模式
let smsServiceInstance: AliyunSmsService | null = null;

export function getAliyunSmsService(): AliyunSmsService {
  if (!smsServiceInstance) {
    smsServiceInstance = new AliyunSmsService();
  }
  return smsServiceInstance;
}

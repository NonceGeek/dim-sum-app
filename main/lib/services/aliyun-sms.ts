import Dysmsapi20170525, * as $Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";

/**
 * 阿里云短信服务封装
 */
export class AliyunSmsService {
  private client: Dysmsapi20170525;

  constructor() {
    const config = new $OpenApi.Config({
      accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET,
    });
    // 短信服务的 endpoint
    config.endpoint = "dysmsapi.aliyuncs.com";
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

    const runtime = new $Util.RuntimeOptions({});

    try {
      const result = await this.client.sendSmsWithOptions(
        sendSmsRequest,
        runtime
      );

      if (result.body.code === "OK") {
        console.log(
          `短信发送成功: ${formattedPhone}, RequestId: ${result.body.requestId}`
        );
        return {
          success: true,
          message: "验证码发送成功",
          requestId: result.body.requestId,
        };
      } else {
        console.error(
          `短信发送失败: ${result.body.code} - ${result.body.message}`
        );
        return {
          success: false,
          message: result.body.message || "短信发送失败",
          requestId: result.body.requestId,
        };
      }
    } catch (error: any) {
      console.error("短信发送异常:", error);
      return {
        success: false,
        message: error.message || "短信发送失败",
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

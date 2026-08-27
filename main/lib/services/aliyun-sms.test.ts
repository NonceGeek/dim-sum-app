import assert from "node:assert/strict";
import test from "node:test";
import { AliyunSmsService } from "./aliyun-sms";

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  ALIYUN_SMS_RELAY_SECRET: process.env.ALIYUN_SMS_RELAY_SECRET,
  ALIYUN_SMS_RELAY_URL: process.env.ALIYUN_SMS_RELAY_URL,
  VERCEL_URL: process.env.VERCEL_URL,
};

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("Vercel SMS sends through the authenticated relay", async () => {
  process.env.ALIYUN_SMS_RELAY_SECRET = "sms-relay-secret";
  process.env.VERCEL_URL = "preview.example.vercel.app";
  delete process.env.ALIYUN_SMS_RELAY_URL;
  let requestedUrl = "";
  let relayToken = "";
  let requestBody: Record<string, unknown> | undefined;

  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    relayToken =
      new Headers(init?.headers).get("x-aliyun-sms-relay-token") || "";
    requestBody = JSON.parse(String(init?.body));
    return Response.json({
      success: true,
      message: "验证码发送成功",
      requestId: "test-request-id",
    });
  };

  const result = await new AliyunSmsService().sendSmsCode(
    "138 0013-8000",
    "123456",
  );
  assert.equal(result.success, true);
  assert.equal(
    requestedUrl,
    "https://preview.example.vercel.app/api/auth/sms-relay",
  );
  assert.equal(relayToken, "sms-relay-secret");
  assert.deepEqual(requestBody, {
    phoneNumber: "13800138000",
    code: "123456",
  });
});

test("Vercel SMS fails safely when the relay secret is missing", async () => {
  delete process.env.ALIYUN_SMS_RELAY_SECRET;
  delete process.env.ALIYUN_SMS_RELAY_URL;
  process.env.VERCEL_URL = "preview.example.vercel.app";
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return Response.json({});
  };

  const result = await new AliyunSmsService().sendSmsCode(
    "13800138000",
    "123456",
  );
  assert.equal(result.success, false);
  assert.equal(result.message, "短信服务配置错误");
  assert.equal(fetchCalled, false);
});

test("invalid phone numbers are rejected before the relay", async () => {
  process.env.ALIYUN_SMS_RELAY_SECRET = "sms-relay-secret";
  process.env.VERCEL_URL = "preview.example.vercel.app";
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return Response.json({});
  };

  const result = await new AliyunSmsService().sendSmsCode("123", "123456");
  assert.equal(result.success, false);
  assert.equal(result.message, "手机号格式不正确");
  assert.equal(fetchCalled, false);
});

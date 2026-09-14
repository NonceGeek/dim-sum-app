import { createDecipheriv, createHash, timingSafeEqual } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";

export class CallbackError extends Error {}
export type CallbackConfig = { appId: string; token: string; aesKey?: string; originalId: string; mode: "plain" | "aes" };

export function checkSignature(signature: string | null, parts: string[]) {
  if (!signature || !/^[a-f0-9]{40}$/i.test(signature) || parts.some(p => !p)) return false;
  const digest = createHash("sha1").update([...parts].sort().join("")).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), digest);
}

export function parseXml(body: string): Record<string, unknown> {
  if (Buffer.byteLength(body) > 65536 || /<!DOCTYPE|<!ENTITY/i.test(body) || XMLValidator.validate(body) !== true) {
    throw new CallbackError("Invalid XML");
  }
  const root = new XMLParser({ parseTagValue: false, ignoreAttributes: true, processEntities: false }).parse(body)?.xml;
  if (!root || typeof root !== "object" || Array.isArray(root)) throw new CallbackError("Invalid XML root");
  return root;
}

export function decryptMessage(encrypted: string, aesKey: string | undefined, appId: string) {
  if (!aesKey || !/^[A-Za-z0-9+/]{43}$/.test(aesKey)) throw new CallbackError("Missing AES configuration");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encrypted)) throw new CallbackError("Invalid ciphertext");
  try {
    const key = Buffer.from(aesKey + "=", "base64");
    const decipher = createDecipheriv("aes-256-cbc", key, key.subarray(0, 16));
    decipher.setAutoPadding(false);
    const padded = Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]);
    const padding = padded[padded.length - 1];
    if (padding < 1 || padding > 32 || !padded.subarray(-padding).every(b => b === padding)) throw new Error();
    const plain = padded.subarray(0, -padding);
    if (plain.length < 20) throw new Error();
    const length = plain.readUInt32BE(16);
    if (20 + length > plain.length || plain.subarray(20 + length).toString() !== appId) throw new Error();
    return plain.subarray(20, 20 + length).toString("utf8");
  } catch {
    throw new CallbackError("Invalid encrypted message");
  }
}

export function verifyCallback(query: URLSearchParams, config: CallbackConfig, body?: string) {
  const timestamp = query.get("timestamp") ?? "";
  const nonce = query.get("nonce") ?? "";
  if (!/^\d{1,12}$/.test(timestamp) || !nonce || nonce.length > 256) throw new CallbackError("Invalid signature parameters");
  // GET verifies the URL, including WeChat's plain handshake when AES is configured.
  if (body === undefined) {
    const echo = query.get("echostr") ?? "";
    if (echo.length > 8192) throw new CallbackError("Invalid challenge");
    if (query.get("encrypt_type") === "aes" || query.has("msg_signature")) {
      if (!checkSignature(query.get("msg_signature"), [config.token, timestamp, nonce, echo])) throw new CallbackError("Invalid signature");
      return decryptMessage(echo, config.aesKey, config.appId);
    }
    if (!checkSignature(query.get("signature"), [config.token, timestamp, nonce])) throw new CallbackError("Invalid signature");
    return echo;
  }
  let message = parseXml(body);
  if (config.mode === "aes" || message.Encrypt !== undefined || query.get("encrypt_type") === "aes") {
    if (typeof message.Encrypt !== "string" || !checkSignature(query.get("msg_signature"), [config.token, timestamp, nonce, message.Encrypt])) {
      throw new CallbackError("Invalid encrypted signature");
    }
    message = parseXml(decryptMessage(message.Encrypt, config.aesKey, config.appId));
  } else if (!checkSignature(query.get("signature"), [config.token, timestamp, nonce])) {
    throw new CallbackError("Invalid signature");
  }
  if (message.ToUserName !== config.originalId) throw new CallbackError("Wrong recipient");
  return message;
}

export function subscriptionEvent(message: Record<string, unknown>) {
  if (message.MsgType !== "event" || !["subscribe", "unsubscribe", "SCAN"].includes(String(message.Event))) return null;
  const openId = message.FromUserName;
  const eventTime = Number(message.CreateTime);
  if (typeof openId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(openId) ||
      !Number.isInteger(eventTime) || eventTime <= 0 || eventTime > 2147483647 || eventTime > Date.now() / 1000 + 300) {
    throw new CallbackError("Invalid event");
  }
  return { openId, eventTime, subscribed: message.Event !== "unsubscribe" };
}

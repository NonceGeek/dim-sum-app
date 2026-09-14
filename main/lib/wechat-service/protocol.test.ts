import { test } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createHash } from "node:crypto";
import { checkSignature, decryptMessage, parseXml, subscriptionEvent, verifyCallback, type CallbackConfig } from "./protocol";
const config: CallbackConfig = { appId: "wx-test-app", token: "test-token", originalId: "gh-test", mode: "plain", aesKey: Buffer.alloc(32, 9).toString("base64").slice(0, -1) };
const timestamp = String(Math.floor(Date.now() / 1000));
const xml = `<xml><ToUserName><![CDATA[gh-test]]></ToUserName><FromUserName><![CDATA[openid-123]]></FromUserName><CreateTime>${timestamp}</CreateTime><MsgType><![CDATA[event]]></MsgType><Event><![CDATA[subscribe]]></Event></xml>`;
const sign = (...parts: string[]) => createHash("sha1").update(parts.sort().join("")).digest("hex");
const query = () => new URLSearchParams({ timestamp, nonce: "nonce", signature: sign(config.token, timestamp, "nonce"), echostr: "challenge" });
function encrypt(message: string, appId = config.appId) {
  const length = Buffer.alloc(4); length.writeUInt32BE(Buffer.byteLength(message));
  const data = Buffer.concat([Buffer.alloc(16, 7), length, Buffer.from(message), Buffer.from(appId)]);
  const pad = 32 - data.length % 32;
  const key = Buffer.from(config.aesKey! + "=", "base64");
  const cipher = createCipheriv("aes-256-cbc", key, key.subarray(0, 16)); cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(Buffer.concat([data, Buffer.alloc(pad, pad)])), cipher.final()]).toString("base64");
}
test("plain handshake and signed subscription", () => {
  assert.equal(verifyCallback(query(), config), "challenge");
  assert.deepEqual(subscriptionEvent(verifyCallback(query(), config, xml) as Record<string, unknown>), { openId: "openid-123", eventTime: Number(timestamp), subscribed: true });
});
test("invalid signature, recipient, unsafe XML and timestamp rejected", () => {
  assert.equal(checkSignature("bad", ["a"]), false);
  const bad = query(); bad.set("signature", "0".repeat(40));
  assert.throws(() => verifyCallback(bad, config, xml));
  assert.throws(() => verifyCallback(query(), config, xml.replace("gh-test", "gh-other")));
  assert.throws(() => parseXml('<!DOCTYPE xml [<!ENTITY x SYSTEM "file:///etc/passwd">]><xml>&x;</xml>'));
  assert.throws(() => parseXml("<xml>"));
  assert.throws(() => parseXml(`<xml>${"x".repeat(65536)}</xml>`));
  assert.throws(() => subscriptionEvent({ ...parseXml(xml), CreateTime: "not-a-time" }));
});
test("AES validates ciphertext, AppID and rejects plain downgrade", () => {
  const encrypted = encrypt(xml);
  const q = query(); q.set("encrypt_type", "aes"); q.set("msg_signature", sign(config.token, timestamp, "nonce", encrypted));
  assert.deepEqual(verifyCallback(q, { ...config, mode: "aes" }, `<xml><Encrypt><![CDATA[${encrypted}]]></Encrypt></xml>`), parseXml(xml));
  assert.throws(() => decryptMessage(encrypt(xml, "other-app"), config.aesKey, config.appId));
  assert.throws(() => verifyCallback(query(), { ...config, mode: "aes" }, xml));
  q.set("msg_signature", "0".repeat(40));
  assert.throws(() => verifyCallback(q, config, `<xml><Encrypt>${encrypted}</Encrypt></xml>`));
});
test("unsubscribe, scan and unrelated messages", () => {
  assert.equal(subscriptionEvent({ ...parseXml(xml), Event: "unsubscribe" })?.subscribed, false);
  assert.equal(subscriptionEvent({ ...parseXml(xml), Event: "SCAN" })?.subscribed, true);
  assert.equal(subscriptionEvent({ ...parseXml(xml), MsgType: "text" }), null);
});

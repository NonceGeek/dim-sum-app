import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { CallbackError, CallbackConfig, subscriptionEvent, verifyCallback } from "@/lib/wechat-service/protocol";
import { WechatFollowerStore } from "@/lib/wechat-service/store";

export const runtime = "nodejs";

function config(): CallbackConfig | null {
  const appId = process.env.WECHAT_SERVICE_APPID;
  const token = process.env.WECHAT_SERVICE_CALLBACK_TOKEN;
  const originalId = process.env.WECHAT_SERVICE_ORIGINAL_ID;
  const mode = process.env.WECHAT_SERVICE_MESSAGE_MODE ?? "aes";
  const aesKey = process.env.WECHAT_SERVICE_ENCODING_AES_KEY;
  if (!appId || !token || !originalId || !["plain", "aes"].includes(mode) || (mode === "aes" && !/^[A-Za-z0-9+/]{43}$/.test(aesKey ?? ""))) return null;
  return { appId, token, originalId, mode: mode as "plain" | "aes", aesKey };
}
const reply = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: NextRequest) {
  const settings = config();
  if (!settings) return reply("Service account callback is not configured", 503);
  try { return reply(verifyCallback(req.nextUrl.searchParams, settings) as string); }
  catch { return reply("Invalid callback", 403); }
}

async function readBody(req: NextRequest) {
  const reader = req.body?.getReader();
  if (!reader) throw new CallbackError("Empty request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) { await reader.cancel(); throw new CallbackError("Request too large"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(req: NextRequest) {
  const settings = config();
  if (!settings) return reply("Service account callback is not configured", 503);
  try {
    const message = verifyCallback(req.nextUrl.searchParams, settings, await readBody(req));
    if (typeof message === "string") throw new CallbackError("Invalid event");
    const event = subscriptionEvent(message);
    if (event) await new WechatFollowerStore(prisma, settings.appId).recordEvent(event);
    return reply("success");
  } catch (error) {
    if (error instanceof CallbackError) return reply("Invalid callback", 403);
    // A non-success response allows WeChat to retry; don't log payloads or OpenIDs.
    console.error("WeChat subscription event persistence failed");
    return reply("Temporary failure", 500);
  }
}

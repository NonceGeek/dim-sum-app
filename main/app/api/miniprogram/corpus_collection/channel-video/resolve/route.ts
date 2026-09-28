import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseChannelVideo } from "@/lib/channel-video";
import { channelSceneId, verifyChannelScene } from "@/lib/channel-video-scan";
import { channelWechatConfig } from "@/lib/wechat-channel-code";

// Public: possession of the scan code opens only the linked Channels work.
// Never return submission metadata or change visibility/review state here.
export async function GET(req: NextRequest) {
  const scene = req.nextUrl.searchParams.get("scene") || "";
  const id = channelSceneId(scene);
  const missing = () => NextResponse.json({ error: "二维码已失效，请在后台重新生成" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!id) return missing();
  try {
    const row = await prisma.corpus_collection_submissions.findUnique({ where: { id }, select: { channel_video: true } });
    const video = parseChannelVideo(row?.channel_video);
    if (!video || !verifyChannelScene(scene, video, channelWechatConfig().secret)) return missing();
    return NextResponse.json({ channelVideo: video }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "暂时无法获取作品，请稍后重试" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

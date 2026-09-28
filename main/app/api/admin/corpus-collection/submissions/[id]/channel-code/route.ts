import { NextRequest, NextResponse } from "next/server";
import { getStringRouteParam, type AppRouteContext } from "@/lib/app-route-context";
import { withSubmissionAccess, submissionScope } from "@/lib/services/submission-access";
import { prisma } from "@/lib/prisma";
import { parseBigIntId } from "@/lib/services/corpus-collection";
import { parseChannelVideo } from "@/lib/channel-video";
import { createChannelScene } from "@/lib/channel-video-scan";
import { channelWechatConfig, generateChannelCode, CHANNEL_CODE_ENVIRONMENTS, type ChannelCodeEnvironment } from "@/lib/wechat-channel-code";

export async function POST(req: NextRequest, context: AppRouteContext) {
  return withSubmissionAccess(req, async (access) => {
    const id = parseBigIntId(await getStringRouteParam(context, "id"));
    const environment = req.nextUrl.searchParams.get("env") || "release";
    if (!id || !CHANNEL_CODE_ENVIRONMENTS.includes(environment as ChannelCodeEnvironment)) return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    const submission = await prisma.corpus_collection_submissions.findFirst({
      where: { id, ...submissionScope(access) }, select: { channel_video: true },
    });
    if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    try {
      const video = parseChannelVideo(submission.channel_video);
      if (!video) return NextResponse.json({ error: "投稿尚未关联视频号作品" }, { status: 404 });
      const scene = createChannelScene(id, video, channelWechatConfig().secret);
      const image = await generateChannelCode(scene, environment as ChannelCodeEnvironment);
      return NextResponse.json({ image: `data:${image.contentType};base64,${image.bytes.toString("base64")}`, environment }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "生成小程序码失败" }, { status: 502 });
    }
  });
}

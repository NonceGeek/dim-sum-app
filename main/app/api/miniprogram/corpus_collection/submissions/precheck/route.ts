import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { precheckCorpusSubmission } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";
import { ChannelVideoError, parseChannelVideo } from "@/lib/channel-video";

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async () => {
    try {
      const body = await req.json();
      const channelVideo = parseChannelVideo(body.channelVideo);
      const images = Array.isArray(body.images) ? body.images : [];

      if (!body.title || !body.intro || images.length > 9) {
        return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
      }

      const result = await precheckCorpusSubmission({
        title: body.title,
        intro: body.intro,
        images,
      });

      return NextResponse.json({
        ...result,
        ...(channelVideo ? { checkedContent: ["text", "images"], channelVideoChecked: false, requiresManualReview: true } : {}),
      });
    } catch (error) {
      if (error instanceof ChannelVideoError) {
        return NextResponse.json({ error: error.message }, { status: 422 });
      }
      return handleAgentApiError(error, "Failed to precheck submission");
    }
  });
}

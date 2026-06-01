import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import {
  transcribeCorpusCollectionAudio,
  type TranscriptionPayload,
} from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";

const SUPPORTED_BASE64_FORMATS = new Set([
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "flac",
]);

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async () => {
    try {
      const body = await req.json().catch(() => ({}));
      const audioUrl = typeof body.audioUrl === "string" ? body.audioUrl.trim() : "";
      const audioBase64 =
        typeof body.audioBase64 === "string" ? body.audioBase64.trim() : "";
      const format = typeof body.format === "string" ? body.format.trim() : "";

      if ((!audioUrl && !audioBase64) || (audioUrl && audioBase64)) {
        return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
      }

      let payload: TranscriptionPayload;
      if (audioBase64) {
        if (!format || !SUPPORTED_BASE64_FORMATS.has(format)) {
          return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
        }
        payload = { audioBase64, format };
      } else {
        payload = format ? { audioUrl, format } : { audioUrl };
      }

      const result = await transcribeCorpusCollectionAudio(payload);
      return NextResponse.json(result);
    } catch (error) {
      return handleAgentApiError(error, "Failed to transcribe audio");
    }
  });
}

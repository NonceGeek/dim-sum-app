import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { scoreGameAudio } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";
import {
  createGameAnswerRecord,
  findContextQuestion,
  findSoundQuestion,
  type YueCubeGameMode,
} from "@/lib/services/yue-cube-game";

const modes = new Set(["context", "sound", "image"]);

function parseTime(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : null;
}

function parseSelectedAnswer(body: Record<string, unknown>) {
  if (typeof body.selected_answer === "string") return body.selected_answer;
  if (typeof body.answer === "string") return body.answer;
  if (typeof body.answer === "boolean") return String(body.answer);
  return null;
}

function parseSelectedIndex(body: Record<string, unknown>) {
  return typeof body.selected_index === "number" && Number.isInteger(body.selected_index)
    ? body.selected_index
    : null;
}

export async function POST(req: NextRequest) {
  return requireMiniprogramAuth(req, async (_req, user) => {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      const mode = typeof body.mode === "string" ? body.mode : "context";
      const questionId =
        typeof body.question_id === "string" ? body.question_id : "";

      if (!modes.has(mode)) {
        return NextResponse.json(
          { error: "Invalid mode. Expected context, sound, or image." },
          { status: 400 }
        );
      }

      if (!questionId && mode !== "image") {
        return NextResponse.json(
          { error: "Missing required field: question_id" },
          { status: 400 }
        );
      }

      if (mode === "context") {
        const question = await findContextQuestion(questionId);

        if (!question) {
          return NextResponse.json(
            { error: "Question not found" },
            { status: 404 }
          );
        }

        const selectedAnswer = parseSelectedAnswer(body);
        const selectedIndex = parseSelectedIndex(body);
        const isCorrect =
          selectedIndex !== null && typeof question.answerIndex === "number"
            ? selectedIndex === question.answerIndex
            : selectedAnswer === question.answer;

        await createGameAnswerRecord({
          userId: user.userId,
          mode,
          questionId,
          scene: question.scene_id,
          selectedAnswer,
          selectedIndex,
          isCorrect,
          timeSpentSeconds: parseTime(body.time),
        });

        return NextResponse.json({
          success: true,
          message: "提交成功",
          is_correct: isCorrect,
          answer: question.answer,
          answerIndex: question.answerIndex,
        });
      }

      if (mode === "sound") {
        const audioUrl = typeof body.audio === "string" ? body.audio : "";
        const question = await findSoundQuestion(questionId);

        if (!question) {
          return NextResponse.json(
            { error: "Question not found" },
            { status: 404 }
          );
        }

        if (!audioUrl) {
          return NextResponse.json(
            { error: "Missing required field: audio" },
            { status: 400 }
          );
        }

        if (!question.audio || !question.jyutping) {
          return NextResponse.json(
            { error: "Question is missing reference audio or jyutping" },
            { status: 422 }
          );
        }

        const result = await scoreGameAudio({
          scene: question.scene_id,
          text: question.question,
          jyutping: question.jyutping,
          userAudioUrl: audioUrl,
          referenceAudioUrl: question.audio,
        });
        const isCorrect = result.score >= 60;

        await createGameAnswerRecord({
          userId: user.userId,
          mode,
          questionId,
          scene: question.scene_id,
          audioUrl,
          score: result.score,
          isCorrect,
          timeSpentSeconds: parseTime(body.time),
          agentResult: result as unknown as Prisma.InputJsonValue,
        });

        return NextResponse.json({
          success: true,
          message: "提交成功",
          is_correct: isCorrect,
          score: result.score,
          comment: result.comment,
        });
      }

      await createGameAnswerRecord({
        userId: user.userId,
        mode: mode as YueCubeGameMode,
        questionId: questionId || null,
        scene: typeof body.scene === "string" ? body.scene : null,
        selectedAnswer: parseSelectedAnswer(body),
        selectedIndex: parseSelectedIndex(body),
        timeSpentSeconds: parseTime(body.time),
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
        audioUrl: typeof body.audio === "string" ? body.audio : null,
      });

      return NextResponse.json({ success: true, message: "提交成功" });
    } catch (error) {
      return handleAgentApiError(error, "Failed to submit answer");
    }
  });
}

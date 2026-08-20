import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  publishQuestionnaireDefinition,
  serializeQuestionnaireSchema,
} from "@/lib/services/questionnaire-definition";
import { QuestionnaireDefinition, questionnaireDefinitionSchema } from "@/lib/services/questionnaire-schema";

const publishSchema = z.object({
  name: z.string().trim().min(1).max(80),
  definition: questionnaireDefinitionSchema,
}).strict();

export async function GET(req: NextRequest) {
  return requireAdmin(req, async () => {
    const rows = await prisma.corpus_collection_questionnaire_schemas.findMany({
      orderBy: { version: "desc" },
      take: 20,
    });
    const schemas = rows.map(serializeQuestionnaireSchema);
    return NextResponse.json({
      current: schemas.find((schema) => schema.status === "published") ?? null,
      versions: schemas.map(({ questions: _questions, ...schema }) => schema),
    });
  });
}

export async function POST(req: NextRequest) {
  return requireAdmin(req, async (_req, operatorId) => {
    const parsed = publishSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({
        error: "INVALID_QUESTIONNAIRE_DEFINITION",
        message: parsed.error.issues[0]?.message ?? "问卷定义无效",
        fields: parsed.error.issues.map((issue) => issue.path.join(".")),
      }, { status: 400 });
    }
    try {
      const published = await publishQuestionnaireDefinition(operatorId, parsed.data as {
        name: string;
        definition: QuestionnaireDefinition;
      });
      return NextResponse.json({ success: true, questionnaire: published }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: "INVALID_QUESTIONNAIRE_DEFINITION" }, { status: 400 });
      }
      throw error;
    }
  });
}

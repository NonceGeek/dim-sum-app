import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  INITIAL_QUESTIONNAIRE_DEFINITION,
  QuestionnaireDefinition,
  QuestionnaireError,
  questionnaireDefinitionSchema,
} from "@/lib/services/questionnaire-schema";

type StoredQuestionnaireSchema = {
  version: number;
  name: string;
  status: string;
  definition: Prisma.JsonValue;
  published_at: Date | null;
  created_at: Date;
};

export function parseStoredQuestionnaireDefinition(value: Prisma.JsonValue) {
  const parsed = questionnaireDefinitionSchema.safeParse(value);
  if (!parsed.success) {
    throw new QuestionnaireError(
      "QUESTIONNAIRE_SCHEMA_INVALID",
      500,
      "数据库中的问卷定义无效，请联系管理员",
    );
  }
  return parsed.data;
}

export function serializeQuestionnaireSchema(row: StoredQuestionnaireSchema) {
  return {
    schemaVersion: row.version,
    name: row.name,
    status: row.status,
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    ...parseStoredQuestionnaireDefinition(row.definition),
  };
}

export async function getPublishedQuestionnaireSchema() {
  const row = await prisma.corpus_collection_questionnaire_schemas.findFirst({
    where: { status: "published" },
    orderBy: [{ published_at: "desc" }, { version: "desc" }],
  });
  if (!row) {
    throw new QuestionnaireError(
      "QUESTIONNAIRE_SCHEMA_UNAVAILABLE",
      503,
      "问卷尚未发布，请稍后再试",
    );
  }
  return serializeQuestionnaireSchema(row);
}

export async function getQuestionnaireDefinitionByVersion(version: number) {
  const row = await prisma.corpus_collection_questionnaire_schemas.findUnique({
    where: { version },
  });
  if (!row) {
    throw new QuestionnaireError(
      "QUESTIONNAIRE_SCHEMA_UNAVAILABLE",
      503,
      "该问卷版本不存在，请重新进入活动",
    );
  }
  return parseStoredQuestionnaireDefinition(row.definition);
}

export async function getQuestionnaireSchemaByVersion(version: number) {
  const row = await prisma.corpus_collection_questionnaire_schemas.findUnique({
    where: { version },
  });
  if (!row) {
    throw new QuestionnaireError(
      "QUESTIONNAIRE_SCHEMA_UNAVAILABLE",
      503,
      "该问卷版本不存在，请重新进入活动",
    );
  }
  return serializeQuestionnaireSchema(row);
}

export async function getQuestionnaireOptionCatalog() {
  const rows = await prisma.corpus_collection_questionnaire_schemas.findMany({
    select: { definition: true },
    orderBy: { version: "asc" },
  });
  const maps = {
    ageRange: new Map<string, string>(),
    cultureRegion: new Map<string, string>(),
    interestTypes: new Map<string, string>(),
  };
  const definitions = [INITIAL_QUESTIONNAIRE_DEFINITION, ...rows.map((row) => parseStoredQuestionnaireDefinition(row.definition))];
  for (const definition of definitions) {
    for (const question of definition.questions) {
      for (const option of question.options) maps[question.key].set(option.code, option.label);
    }
  }
  return {
    age: [...maps.ageRange.entries()],
    region: [...maps.cultureRegion.entries()],
    interest: [...maps.interestTypes.entries()],
  };
}

export async function publishQuestionnaireDefinition(
  operatorId: string,
  input: { name: string; definition: QuestionnaireDefinition },
) {
  const definition = questionnaireDefinitionSchema.parse(input.definition);
  return prisma.$transaction(async (tx) => {
    const latest = await tx.corpus_collection_questionnaire_schemas.aggregate({
      _max: { version: true },
    });
    const version = (latest._max.version ?? 0) + 1;
    const now = new Date();
    await tx.corpus_collection_questionnaire_schemas.updateMany({
      where: { status: "published" },
      data: { status: "archived" },
    });
    const created = await tx.corpus_collection_questionnaire_schemas.create({
      data: {
        version,
        name: input.name,
        status: "published",
        definition: definition as Prisma.InputJsonValue,
        published_at: now,
        created_by: operatorId,
      },
    });
    await tx.corpus_collection_audit_logs.create({
      data: {
        operator_id: operatorId,
        action: "questionnaire.schema.published",
        filters: {},
        result_summary: {
          version,
          questionCount: definition.questions.length,
        },
      },
    });
    return serializeQuestionnaireSchema(created);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

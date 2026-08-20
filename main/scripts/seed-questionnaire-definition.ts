import { Prisma, PrismaClient } from "@prisma/client";
import {
  INITIAL_QUESTIONNAIRE_DEFINITION,
  questionnaireDefinitionSchema,
} from "../lib/services/questionnaire-schema";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.corpus_collection_questionnaire_schemas.findUnique({
    where: { version: 1 },
  });
  if (existing) {
    const definition = questionnaireDefinitionSchema.parse(existing.definition);
    console.log(`Questionnaire schema v1 already exists with ${definition.questions.length} questions; nothing changed.`);
    return;
  }
  await prisma.corpus_collection_questionnaire_schemas.create({
    data: {
      version: 1,
      name: "参赛前问卷",
      status: "published",
      definition: INITIAL_QUESTIONNAIRE_DEFINITION as unknown as Prisma.InputJsonValue,
      published_at: new Date(),
    },
  });
  console.log("Questionnaire schema v1 created and published.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

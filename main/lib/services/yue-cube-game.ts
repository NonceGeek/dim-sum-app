import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SOUND_CORPUS_CATEGORY = "yywj2";
const DEFAULT_DAILY_TARGET = 10;

type JsonObject = Record<string, unknown>;

export type YueCubeGameMode = "context" | "sound" | "image";

export interface GameAnswerRecordInput {
  userId: string;
  mode: YueCubeGameMode;
  questionId?: string | null;
  scene?: string | null;
  selectedAnswer?: string | null;
  selectedIndex?: number | null;
  isCorrect?: boolean | null;
  timeSpentSeconds?: number | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
  score?: number | null;
  agentResult?: Prisma.InputJsonValue | null;
}

export interface ContextQuestionPayload {
  stemPre?: string;
  stemPost?: string;
  question?: Array<{ role: string; content: string }>;
  answer?: string;
  answerIndex?: number;
  options?: Array<{ text: string; jyutping?: string; pronunciation?: string }>;
  explanation?: string;
  scenario?: string;
}

interface RawSoundQuestion {
  id: bigint;
  unique_id: string | null;
  data: string;
  note: unknown;
  structured_note: unknown;
  category: string;
}

interface RawContextQuestion {
  id: bigint;
  scene: string;
  scene_name: string | null;
  payload: Prisma.JsonValue;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (Array.isArray(value)) {
      const item = value.find((entry) => typeof entry === "string" && entry.trim());
      if (typeof item === "string") return item;
    }
  }

  return "";
}

function normalizeContextQuestion(question: {
  id: bigint;
  scene: string;
  scene_name?: string | null;
  payload: Prisma.JsonValue;
}) {
  const payload = asObject(question.payload) as ContextQuestionPayload;
  const answerIndex =
    typeof payload.answerIndex === "number" ? payload.answerIndex : undefined;
  const answer =
    payload.answer ||
    (answerIndex !== undefined ? payload.options?.[answerIndex]?.text : undefined) ||
    "";

  return {
    id: question.id.toString(),
    scene_id: question.scene,
    question:
      payload.question ??
      [
        {
          role: "题目",
          content: `${payload.stemPre ?? ""}____${payload.stemPost ?? ""}`,
        },
      ],
    stemPre: payload.stemPre,
    stemPost: payload.stemPost,
    options: (payload.options ?? []).map((option) => ({
      text: option.text,
      pronunciation: option.pronunciation ?? option.jyutping ?? "",
      jyutping: option.jyutping ?? option.pronunciation ?? "",
    })),
    answer,
    answerIndex,
    scenario: payload.scenario ?? question.scene_name ?? question.scene,
    explanation: payload.explanation,
  };
}

function normalizeSoundQuestion(row: RawSoundQuestion) {
  const note = asObject(row.note);
  const structuredNote = asObject(row.structured_note);
  const context = asObject(note.context);
  const structuredContext = asObject(structuredNote.context);

  return {
    id: row.unique_id || row.id.toString(),
    scene_id: firstString(context.scene, structuredContext.scene, row.category),
    question: row.data,
    meaning: firstString(
      context.meaning,
      context.translation,
      context.meanings,
      note.meaning,
      structuredContext.meaning,
      structuredNote.meaning
    ),
    jyutping: firstString(
      context.jyutping,
      context.pinyin,
      context.yuepin,
      note.jyutping,
      structuredContext.jyutping,
      structuredNote.jyutping
    ),
    audio: firstString(
      context.audio,
      context.audio_url,
      context.audioUrl,
      note.audio,
      structuredContext.audio,
      structuredNote.audio
    ),
  };
}

function clampLimit(value: string | null, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 50);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function diffDays(from: Date, to: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / msPerDay);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function levelForCompletedQuestions(completedQuestions: number) {
  if (completedQuestions >= 200) return "advanced";
  if (completedQuestions >= 50) return "intermediate";
  return "beginner";
}

function modeCompletedField(mode: YueCubeGameMode) {
  if (mode === "context") return "context_completed";
  if (mode === "sound") return "sound_completed";
  return "image_completed";
}

function modeCorrectField(mode: YueCubeGameMode) {
  if (mode === "context") return "context_correct";
  if (mode === "sound") return "sound_correct";
  return "image_correct";
}

async function updatePlayerProgress(
  tx: Prisma.TransactionClient,
  input: GameAnswerRecordInput
) {
  const today = startOfToday();
  const existing = await tx.game_player_progress.findUnique({
    where: { user_id: input.userId },
  });
  const timeSpentSeconds = input.timeSpentSeconds ?? 0;
  const isGraded = input.isCorrect !== null && input.isCorrect !== undefined;
  const isCorrect = input.isCorrect === true;
  const completedQuestions = (existing?.completed_questions ?? 0) + 1;
  const gradedQuestions = (existing?.graded_questions ?? 0) + (isGraded ? 1 : 0);
  const correctQuestions = (existing?.correct_questions ?? 0) + (isCorrect ? 1 : 0);
  const lastPlayedDate = existing?.last_played_date ?? null;
  const streakDays = lastPlayedDate
    ? diffDays(lastPlayedDate, today) === 0
      ? existing.current_streak_days
      : diffDays(lastPlayedDate, today) === 1
        ? existing.current_streak_days + 1
        : 1
    : 1;
  const accuracy = gradedQuestions > 0 ? correctQuestions / gradedQuestions : 0;
  const completedField = modeCompletedField(input.mode);
  const correctField = modeCorrectField(input.mode);

  const data = {
    total_time_seconds: (existing?.total_time_seconds ?? 0) + timeSpentSeconds,
    completed_questions: completedQuestions,
    correct_questions: correctQuestions,
    graded_questions: gradedQuestions,
    accuracy,
    level: levelForCompletedQuestions(completedQuestions),
    current_streak_days: streakDays,
    last_played_date: today,
    context_completed:
      (existing?.context_completed ?? 0) + (completedField === "context_completed" ? 1 : 0),
    sound_completed:
      (existing?.sound_completed ?? 0) + (completedField === "sound_completed" ? 1 : 0),
    image_completed:
      (existing?.image_completed ?? 0) + (completedField === "image_completed" ? 1 : 0),
    context_correct:
      (existing?.context_correct ?? 0) + (isCorrect && correctField === "context_correct" ? 1 : 0),
    sound_correct:
      (existing?.sound_correct ?? 0) + (isCorrect && correctField === "sound_correct" ? 1 : 0),
    image_correct:
      (existing?.image_correct ?? 0) + (isCorrect && correctField === "image_correct" ? 1 : 0),
  };

  if (existing) {
    await tx.game_player_progress.update({
      where: { user_id: input.userId },
      data,
    });
    return;
  }

  await tx.game_player_progress.create({
    data: {
      user_id: input.userId,
      ...data,
    },
  });
}

export async function createGameAnswerRecord(input: GameAnswerRecordInput) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.game_answer_records.create({
      data: {
        user_id: input.userId,
        mode: input.mode,
        question_id: input.questionId,
        scene: input.scene,
        selected_answer: input.selectedAnswer,
        selected_index: input.selectedIndex,
        is_correct: input.isCorrect,
        time_spent_seconds: input.timeSpentSeconds,
        audio_url: input.audioUrl,
        image_url: input.imageUrl,
        score: input.score,
        agent_result: input.agentResult ?? Prisma.JsonNull,
      },
    });

    await updatePlayerProgress(tx, input);
    return record;
  });
}

export function parseQuestionLimit(value: string | null) {
  return clampLimit(value);
}

export async function getTodayProgress(userId: string) {
  const today = startOfToday();
  const [completedToday, progress] = await Promise.all([
    prisma.game_answer_records.count({
      where: {
        user_id: userId,
        created_at: { gte: today },
      },
    }),
    prisma.game_player_progress.findUnique({
      where: { user_id: userId },
      select: { current_streak_days: true, last_played_date: true },
    }),
  ]);
  const consecutiveDays =
    progress?.last_played_date && diffDays(progress.last_played_date, today) === 0
      ? progress.current_streak_days
      : 0;

  return {
    today_progress: Math.min(completedToday / DEFAULT_DAILY_TARGET, 1),
    consecutive_days: consecutiveDays,
    completed_questions: completedToday,
  };
}

export async function getPlayerProgress(userId: string) {
  const progress = await prisma.game_player_progress.findUnique({
    where: { user_id: userId },
  });

  return {
    total_time: progress?.total_time_seconds ?? 0,
    completed_questions: progress?.completed_questions ?? 0,
    accuracy: progress?.accuracy ?? 0,
    level: progress?.level ?? "beginner",
  };
}

export async function getQuestionScenes(mode: YueCubeGameMode) {
  if (mode === "context") {
    const scenes = await prisma.$queryRaw<
      Array<{ code: string; name: string; total: number | bigint }>
    >`
      SELECT s.code, s.name, COUNT(q.id)::int AS total
        FROM game_scenes s
        LEFT JOIN game_cloze_questions q
          ON q.scene = s.code
         AND q.status = 'active'
       WHERE s.game_type = 'cloze'
         AND s.status = 'active'
       GROUP BY s.code, s.name, s.sort_order
       ORDER BY s.sort_order ASC, s.name ASC, s.code ASC
    `;

    return scenes.map((scene) => ({
      id: scene.code,
      scene: scene.name,
      total: Number(scene.total),
    }));
  }

  if (mode === "sound") {
    const total = await prisma.cantonese_corpus_all.count({
      where: { category: SOUND_CORPUS_CATEGORY },
    });

    return [
      {
        id: SOUND_CORPUS_CATEGORY,
        scene: "粤语万句",
        total,
      },
    ];
  }

  return [
    { id: "daily", scene: "日常生活", total: 0 },
    { id: "food", scene: "饮食", total: 0 },
    { id: "travel", scene: "出行", total: 0 },
  ];
}

export async function getContextQuestions(scene: string | null, limit: number) {
  const rows = scene
    ? await prisma.$queryRaw<RawContextQuestion[]>`
        SELECT q.id, q.scene, s.name AS scene_name, q.payload
          FROM game_cloze_questions q
          JOIN game_scenes s
            ON s.game_type = 'cloze'
           AND s.code = q.scene
           AND s.status = 'active'
         WHERE q.status = 'active'
           AND q.scene = ${scene}
         ORDER BY random()
         LIMIT ${limit}
      `
    : await prisma.$queryRaw<RawContextQuestion[]>`
        SELECT q.id, q.scene, s.name AS scene_name, q.payload
          FROM game_cloze_questions q
          JOIN game_scenes s
            ON s.game_type = 'cloze'
           AND s.code = q.scene
           AND s.status = 'active'
         WHERE q.status = 'active'
         ORDER BY random()
         LIMIT ${limit}
      `;

  return rows.map(normalizeContextQuestion);
}

export async function getSoundQuestions(limit: number) {
  const rows = await prisma.$queryRaw<RawSoundQuestion[]>`
    SELECT id, unique_id::text AS unique_id, data, note, structured_note, category
      FROM cantonese_corpus_all
     WHERE category = ${SOUND_CORPUS_CATEGORY}
     ORDER BY random()
     LIMIT ${limit}
  `;

  return rows.map(normalizeSoundQuestion);
}

export async function findContextQuestion(questionId: string) {
  if (!/^\d+$/.test(questionId)) return null;

  const id = BigInt(questionId);
  const rows = await prisma.$queryRaw<RawContextQuestion[]>`
    SELECT q.id, q.scene, s.name AS scene_name, q.payload
      FROM game_cloze_questions q
      JOIN game_scenes s
        ON s.game_type = 'cloze'
       AND s.code = q.scene
       AND s.status = 'active'
     WHERE q.id = ${id}
       AND q.status = 'active'
     LIMIT 1
  `;

  return rows[0] ? normalizeContextQuestion(rows[0]) : null;
}

export async function findSoundQuestion(questionId: string) {
  const id = /^\d+$/.test(questionId) ? BigInt(questionId) : null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    questionId
  )
    ? questionId
    : null;

  if (!id && !uuid) return null;

  const rows = id
    ? await prisma.$queryRaw<RawSoundQuestion[]>`
        SELECT id, unique_id::text AS unique_id, data, note, structured_note, category
          FROM cantonese_corpus_all
         WHERE id = ${id} AND category = ${SOUND_CORPUS_CATEGORY}
         LIMIT 1
      `
    : await prisma.$queryRaw<RawSoundQuestion[]>`
        SELECT id, unique_id::text AS unique_id, data, note, structured_note, category
          FROM cantonese_corpus_all
         WHERE unique_id = ${uuid}::uuid AND category = ${SOUND_CORPUS_CATEGORY}
         LIMIT 1
      `;

  return rows[0] ? normalizeSoundQuestion(rows[0]) : null;
}

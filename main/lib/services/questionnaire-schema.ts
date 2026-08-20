import { z } from "zod";

export const QUESTIONNAIRE_SCHEMA_VERSION = 1;

export const AGE_OPTIONS = [
  ["under_18", "18岁以下"],
  ["age_18_24", "18-24"],
  ["age_25_34", "25-34"],
  ["age_35_44", "35-44"],
  ["age_45_plus", "45岁及以上"],
] as const;

export const CULTURE_REGION_OPTIONS = [
  ["guangzhou", "广州"],
  ["foshan", "佛山"],
  ["jiangmen", "江门"],
  ["hong_kong", "香港"],
  ["macao", "澳门"],
  ["zhuhai", "珠海"],
  ["shunde", "顺德"],
  ["overseas_cantonese", "海外粤语文化圈"],
] as const;

export const INTEREST_TYPE_OPTIONS = [
  ["language_usage", "用语"],
  ["story", "故事"],
  ["poetry", "诗歌"],
  ["place_name_explanation", "地名解说"],
  ["proverb", "俗语"],
  ["natural_conversation", "自然对话"],
  ["cantonese_film_tv", "粤语影视剧"],
  ["cantonese_dubbed_animation", "粤语配音动画片"],
  ["other", "其他"],
] as const;

const codes = <T extends readonly (readonly [string, string])[]>(options: T) =>
  options.map(([code]) => code) as [T[number][0], ...T[number][0][]];

export const questionnaireAnswersSchema = z.object({
  ageRange: z.enum(codes(AGE_OPTIONS)),
  cultureRegion: z.enum(codes(CULTURE_REGION_OPTIONS)),
  interestTypes: z.array(z.enum(codes(INTEREST_TYPE_OPTIONS))).max(INTEREST_TYPE_OPTIONS.length).default([]),
}).strict();

export const entryRequestSchema = z.object({
  activityId: z.string().regex(/^\d+$/),
  clientEventId: z.string().uuid(),
}).strict();

export const clientEventRequestSchema = z.object({
  journeyId: z.string().uuid(),
  clientEventId: z.string().uuid(),
  eventName: z.enum(["open_questionnaire", "continue_questionnaire", "cancel_questionnaire"]),
}).strict();

export const submitQuestionnaireRequestSchema = z.object({
  journeyId: z.string().uuid(),
  schemaVersion: z.literal(QUESTIONNAIRE_SCHEMA_VERSION).optional(),
  answers: questionnaireAnswersSchema.optional(),
  phoneBinding: z.object({
    phoneNumber: z.string(),
    verificationCode: z.string().regex(/^\d{6}$/),
    confirmMerge: z.boolean().default(false),
  }).strict().optional(),
}).strict();

export const enterSubmissionRequestSchema = z.object({
  journeyId: z.string().uuid(),
  clientEventId: z.string().uuid(),
}).strict();

function options(items: readonly (readonly [string, string])[]) {
  return items.map(([code, label]) => ({ code, label }));
}

export const QUESTIONNAIRE_SCHEMA = {
  schemaVersion: QUESTIONNAIRE_SCHEMA_VERSION,
  questions: [
    {
      key: "ageRange",
      type: "single_choice",
      required: true,
      title: "你的年龄区间是？",
      options: options(AGE_OPTIONS),
    },
    {
      key: "cultureRegion",
      type: "single_choice",
      required: true,
      title: "你更熟悉哪个地区的语言文化？",
      description: "用于推荐更贴近你背景的活动内容，不涉及身份认证。",
      options: options(CULTURE_REGION_OPTIONS),
    },
    {
      key: "interestTypes",
      type: "multiple_choice",
      required: false,
      title: "你更感兴趣的活动类型是？",
      options: options(INTEREST_TYPE_OPTIONS),
    },
  ],
} as const;

export type QuestionnaireAnswers = z.infer<typeof questionnaireAnswersSchema>;

export class QuestionnaireError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function questionnaireErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      body: {
        error: "INVALID_REQUEST",
        message: "请求参数无效",
        details: { fields: [...new Set(error.issues.map((issue) => issue.path.join(".")))] },
      },
    };
  }
  if (error instanceof QuestionnaireError) {
    return {
      status: error.status,
      body: { error: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    };
  }
  console.error("[Questionnaire] Unexpected error", error);
  return { status: 500, body: { error: "INTERNAL_ERROR", message: "服务器错误" } };
}

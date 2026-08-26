import { z } from "zod";

export const QUESTIONNAIRE_KEYS = ["ageRange", "cultureRegion", "interestTypes"] as const;

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

export const questionnaireAnswersSchema = z.object({
  ageRange: z.string().min(1),
  cultureRegion: z.string().min(1),
  interestTypes: z.array(z.string().min(1)).max(30).default([]),
}).strict();

const questionnaireOptionSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  label: z.string().trim().min(1).max(40),
}).strict();

const questionnaireQuestionSchema = z.object({
  key: z.enum(QUESTIONNAIRE_KEYS),
  type: z.enum(["single_choice", "multiple_choice"]),
  required: z.boolean(),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(200).optional(),
  options: z.array(questionnaireOptionSchema).min(1).max(30),
}).strict().superRefine((question, ctx) => {
  const optionCodes = question.options.map((option) => option.code);
  if (new Set(optionCodes).size !== optionCodes.length) {
    ctx.addIssue({ code: "custom", message: "同一题目的选项 code 不能重复", path: ["options"] });
  }
  const expectedType = question.key === "interestTypes" ? "multiple_choice" : "single_choice";
  if (question.type !== expectedType) {
    ctx.addIssue({ code: "custom", message: `${question.key} 的题型不能修改`, path: ["type"] });
  }
  const expectedRequired = question.key !== "interestTypes";
  if (question.required !== expectedRequired) {
    ctx.addIssue({ code: "custom", message: `${question.key} 的必填规则不能修改`, path: ["required"] });
  }
});

export const questionnaireDefinitionSchema = z.object({
  questions: z.array(questionnaireQuestionSchema).length(QUESTIONNAIRE_KEYS.length),
}).strict().superRefine((definition, ctx) => {
  const keys = definition.questions.map((question) => question.key);
  for (const key of QUESTIONNAIRE_KEYS) {
    if (keys.filter((value) => value === key).length !== 1) {
      ctx.addIssue({ code: "custom", message: `必须且只能包含一个 ${key} 题目`, path: ["questions"] });
    }
  }
});

export const entryRequestSchema = z.object({
  activityId: z.string().regex(/^\d+$/),
  clientEventId: z.string().uuid(),
}).strict();

export const clientEventRequestSchema = z.object({
  journeyId: z.string().uuid(),
  clientEventId: z.string().uuid(),
  eventName: z.enum([
    "open_questionnaire",
    "continue_questionnaire",
    "cancel_questionnaire",
    "enter_submission_page",
  ]),
}).strict();

export const submitQuestionnaireRequestSchema = z.object({
  journeyId: z.string().uuid(),
  schemaVersion: z.number().int().positive().optional(),
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

export const INITIAL_QUESTIONNAIRE_DEFINITION = {
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
export type QuestionnaireDefinition = z.infer<typeof questionnaireDefinitionSchema>;

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

export function validateQuestionnaireAnswers(
  definition: QuestionnaireDefinition,
  input: QuestionnaireAnswers,
) {
  const answers = questionnaireAnswersSchema.parse(input);
  const optionCodes = new Map(
    definition.questions.map((question) => [
      question.key,
      new Set(question.options.map((option) => option.code)),
    ]),
  );
  if (!optionCodes.get("ageRange")?.has(answers.ageRange)) {
    throw new QuestionnaireError("QUESTIONNAIRE_VALIDATION_FAILED", 400, "年龄区间选项无效");
  }
  if (!optionCodes.get("cultureRegion")?.has(answers.cultureRegion)) {
    throw new QuestionnaireError("QUESTIONNAIRE_VALIDATION_FAILED", 400, "语言文化地区选项无效");
  }
  if (new Set(answers.interestTypes).size !== answers.interestTypes.length) {
    throw new QuestionnaireError("QUESTIONNAIRE_VALIDATION_FAILED", 400, "兴趣类型选项不能重复");
  }
  if (answers.interestTypes.some((value) => !optionCodes.get("interestTypes")?.has(value))) {
    throw new QuestionnaireError("QUESTIONNAIRE_VALIDATION_FAILED", 400, "兴趣类型选项无效");
  }
  return answers;
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

import { prisma } from "@/lib/prisma";
import { AliyunSmsService, getAliyunSmsService } from "@/lib/services/aliyun-sms";
import { QuestionnaireError } from "@/lib/services/questionnaire-schema";
import { mergeUserRelations } from "@/lib/user-merge";

const CODE_TTL_MS = 10 * 60 * 1000;
const RETRY_AFTER_MS = 60 * 1000;

function identifier(phoneNumber: string, userId: string) {
  return `questionnaire-bind:${phoneNumber}:${userId}`;
}

function maskPhone(phoneNumber: string) {
  return `${phoneNumber.slice(0, 3)}****${phoneNumber.slice(-4)}`;
}

function normalizePhone(phoneNumber: string) {
  const formatted = AliyunSmsService.formatPhoneNumber(phoneNumber);
  if (!AliyunSmsService.isValidPhoneNumber(formatted)) {
    throw new QuestionnaireError("PHONE_INVALID", 400, "手机号格式错误");
  }
  return formatted;
}

async function assertJourneyCanBind(userId: string, journeyId: string) {
  const journey = await prisma.corpus_collection_questionnaire_journeys.findFirst({
    where: { id: journeyId, user_id: userId },
    select: { expires_at: true, status: true },
  });
  if (!journey) throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "参赛旅程不存在");
  if (journey.expires_at.getTime() <= Date.now()) {
    throw new QuestionnaireError("JOURNEY_EXPIRED", 410, "参赛旅程已过期");
  }
  if (["cancelled", "expired", "submitted"].includes(journey.status)) {
    throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "当前旅程不能绑定手机号");
  }
}

export async function sendQuestionnairePhoneCode(
  userId: string,
  input: { journeyId: string; phoneNumber: string },
) {
  await assertJourneyCanBind(userId, input.journeyId);
  const phoneNumber = normalizePhone(input.phoneNumber);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phoneNumber: true } });
  if (!user) throw new QuestionnaireError("AUTH_REQUIRED", 401, "用户不存在");
  if (user.phoneNumber) {
    throw new QuestionnaireError("JOURNEY_STATE_CONFLICT", 409, "当前账号已绑定手机号");
  }
  const tokenIdentifier = identifier(phoneNumber, userId);
  const recent = await prisma.verificationToken.findFirst({
    where: {
      identifier: tokenIdentifier,
      expires: { gt: new Date(Date.now() + CODE_TTL_MS - RETRY_AFTER_MS) },
    },
  });
  if (recent) throw new QuestionnaireError("SMS_RATE_LIMITED", 429, "验证码发送过于频繁");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: tokenIdentifier } }),
    prisma.verificationToken.create({
      data: { identifier: tokenIdentifier, token: code, expires: new Date(Date.now() + CODE_TTL_MS) },
    }),
  ]);
  const result = await getAliyunSmsService().sendSmsCode(phoneNumber, code);
  if (!result.success) {
    await prisma.verificationToken.deleteMany({ where: { identifier: tokenIdentifier } });
    throw new QuestionnaireError("INTERNAL_ERROR", 500, result.message || "短信发送失败");
  }
  return {
    success: true,
    maskedPhoneNumber: maskPhone(phoneNumber),
    expiresInSeconds: CODE_TTL_MS / 1000,
    retryAfterSeconds: RETRY_AFTER_MS / 1000,
  };
}

export async function bindQuestionnairePhone(
  userId: string,
  input: {
    journeyId: string;
    phoneNumber: string;
    verificationCode: string;
    confirmMerge: boolean;
  },
) {
  await assertJourneyCanBind(userId, input.journeyId);
  const phoneNumber = normalizePhone(input.phoneNumber);
  const tokenIdentifier = identifier(phoneNumber, userId);
  const token = await prisma.verificationToken.findFirst({
    where: {
      identifier: tokenIdentifier,
      token: input.verificationCode,
      expires: { gt: new Date() },
    },
  });
  if (!token) throw new QuestionnaireError("PHONE_CODE_INVALID", 400, "验证码错误或已过期");

  const existingUser = await prisma.user.findFirst({
    where: { phoneNumber, id: { not: userId } },
    select: {
      id: true,
      questionnaireProfile: { select: { id: true } },
      _count: {
        select: {
          questionnaireJourneys: true,
          questionnaireEvents: true,
          questionnairePermissions: true,
        },
      },
    },
  });
  if (existingUser && !input.confirmMerge) {
    throw new QuestionnaireError(
      "MERGE_REQUIRED",
      409,
      "该手机号已关联另一个账号，继续后将合并账号数据。",
      { canRetryWithSameCode: true },
    );
  }
  if (
    existingUser?.questionnaireProfile ||
    (existingUser &&
      (existingUser._count.questionnaireJourneys > 0 ||
        existingUser._count.questionnaireEvents > 0 ||
        existingUser._count.questionnairePermissions > 0))
  ) {
    throw new QuestionnaireError(
      "PROFILE_ALREADY_EXISTS",
      409,
      "目标手机号账号已存在问卷档案，请联系管理员处理账号合并。",
    );
  }

  await prisma.$transaction(async (tx) => {
    if (existingUser) await mergeUserRelations(tx, existingUser.id, userId);
    await tx.user.update({ where: { id: userId }, data: { phoneNumber } });
    const smsAccount = await tx.account.findFirst({ where: { userId, provider: "sms" } });
    if (smsAccount) {
      await tx.account.update({
        where: { id: smsAccount.id },
        data: { providerAccountId: phoneNumber },
      });
    } else {
      await tx.account.create({
        data: { type: "credentials", provider: "sms", providerAccountId: phoneNumber, userId },
      });
    }
    await tx.verificationToken.delete({
      where: { identifier_token: { identifier: tokenIdentifier, token: input.verificationCode } },
    });
  }, { timeout: 30000, maxWait: 10000 });

  return { status: "verified" as const, maskedPhoneNumber: maskPhone(phoneNumber) };
}

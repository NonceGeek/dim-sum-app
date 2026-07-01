import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { AliyunSmsService } from "@/lib/services/aliyun-sms";
import { prisma } from "@/lib/prisma";
import { mergeUserRelations } from "@/lib/user-merge";

export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { phoneNumber, code, confirmMerge } = await request.json();

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: "请输入手机号和验证码" },
        { status: 400 }
      );
    }

    // 格式化手机号
    const formattedPhone = AliyunSmsService.formatPhoneNumber(phoneNumber);

    if (!AliyunSmsService.isValidPhoneNumber(formattedPhone)) {
      return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
    }

    // 验证验证码
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: `bind:${formattedPhone}:${session.user.id}`,
        token: code,
        expires: {
          gt: new Date(),
        },
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "验证码无效或已过期" },
        { status: 400 }
      );
    }

    // 再次检查手机号是否已被其他用户绑定（防止竞态条件）
    const existingUser = await prisma.user.findFirst({
      where: {
        phoneNumber: formattedPhone,
        id: { not: session.user.id },
      },
    });

    if (existingUser) {
      // 该手机号已被另一个账号（通常是小程序「手机号自由注册」产生的账号）占用。
      // 合并是不可逆操作（会删除占用账号），必须经用户显式确认。
      // 未确认时返回 MERGE_REQUIRED，且【不消费验证码】，以便用户确认后用同一验证码再次提交。
      if (!confirmMerge) {
        return NextResponse.json(
          {
            error: "MERGE_REQUIRED",
            message:
              "该手机号已关联另一个账号。继续绑定将把该账号的数据合并到当前账号，且原账号会被删除，此操作不可撤销。",
          },
          { status: 409 }
        );
      }

      // 用户已通过短信验证码证明其拥有该号码，且已确认合并：
      // 将占用账号合并进当前登录账号。
      await prisma.$transaction(
        async (tx) => {
          // 1) 合并：快照归档 + 字段级合并 + 源账号软删除（内部已把源手机号置空、释放唯一约束）
          await mergeUserRelations(tx, existingUser.id, session.user.id);
          // 2) 手机号落到当前用户
          await tx.user.update({
            where: { id: session.user.id },
            data: { phoneNumber: formattedPhone },
          });
          // 4) 确保当前用户有对应的 SMS Account（合并时占用账号的 sms account 已被 repoint 过来）
          const smsAccount = await tx.account.findFirst({
            where: { userId: session.user.id, provider: "sms" },
          });
          if (!smsAccount) {
            await tx.account.create({
              data: {
                type: "credentials",
                provider: "sms",
                providerAccountId: formattedPhone,
                userId: session.user.id,
              },
            });
          } else {
            await tx.account.update({
              where: { id: smsAccount.id },
              data: { providerAccountId: formattedPhone },
            });
          }
          // 5) 删除已使用的验证码
          await tx.verificationToken.delete({
            where: {
              identifier_token: {
                identifier: `bind:${formattedPhone}:${session.user.id}`,
                token: code,
              },
            },
          });
        },
        { timeout: 30000, maxWait: 10000 }
      );

      return NextResponse.json({
        success: true,
        merged: true,
        message: "手机号绑定成功，且已合并该号码原有的账号数据",
        phoneNumber:
          formattedPhone.slice(0, 3) + "****" + formattedPhone.slice(-4),
      });
    }

    // 使用事务绑定手机号并删除验证码
    await prisma.$transaction(async (tx) => {
      // 绑定手机号到用户
      await tx.user.update({
        where: { id: session.user.id },
        data: { phoneNumber: formattedPhone },
      });

      // 删除已使用的验证码
      await tx.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: `bind:${formattedPhone}:${session.user.id}`,
            token: code,
          },
        },
      });

      // 创建 SMS Account 记录（用于短信登录）
      const existingAccount = await tx.account.findFirst({
        where: {
          userId: session.user.id,
          provider: "sms",
        },
      });

      if (!existingAccount) {
        await tx.account.create({
          data: {
            type: "credentials",
            provider: "sms",
            providerAccountId: formattedPhone,
            userId: session.user.id,
          },
        });
      } else {
        // 更新已有的 SMS Account 记录
        await tx.account.update({
          where: { id: existingAccount.id },
          data: { providerAccountId: formattedPhone },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "手机号绑定成功",
      phoneNumber:
        formattedPhone.slice(0, 3) + "****" + formattedPhone.slice(-4),
    });
  } catch (error) {
    console.error("Bind phone error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

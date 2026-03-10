import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function SmsProvider() {
  return {
    id: "sms",
    type: "credentials" as const,
    name: "SMS",
    credentials: {
      phoneNumber: { label: "Phone Number", type: "text" },
      code: { label: "Verification Code", type: "text" },
      role: { label: "Role", type: "text" },
    },
    async authorize(credentials: Record<string, string> | undefined) {
      if (!credentials?.phoneNumber || !credentials?.code) {
        return null;
      }

      try {
        // 格式化手机号
        const phoneNumber = credentials.phoneNumber.replace(/[\s\-\(\)]/g, "");

        // 验证验证码
        const verificationToken = await prisma.verificationToken.findFirst({
          where: {
            identifier: phoneNumber,
            token: credentials.code,
            expires: {
              gt: new Date(),
            },
          },
        });

        if (!verificationToken) {
          console.log("SMS verification failed: invalid or expired code");
          return null;
        }

        // 查找或创建用户
        let user = await prisma.user.findFirst({
          where: { phoneNumber: phoneNumber },
        });

        if (!user) {
          // 创建新用户（注册即登录）
          user = await prisma.user.create({
            data: {
              phoneNumber: phoneNumber,
              name: `用户${phoneNumber.slice(-4)}`,
              role: Role.LEARNER,
            },
          });
          console.log("Created new user via SMS:", user.id);
        }

        // 删除已使用的验证码
        await prisma.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: phoneNumber,
              token: credentials.code,
            },
          },
        });

        return {
          id: user.id,
          phoneNumber: user.phoneNumber,
          name: user.name,
          image: user.image,
          role: user.role,
          isSystemAdmin: user.isSystemAdmin,
        };
      } catch (error) {
        console.error("SMS provider error:", error);
        return null;
      }
    },
  };
}

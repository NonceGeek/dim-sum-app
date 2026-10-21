/**
 * 本地开发登录：本地发不了邮件/短信、微信回调不到 localhost，
 * 这里直接建一个系统管理员调试账号，并写入一条 10 分钟有效的邮箱验证码。
 *
 * 使用方式：
 *   pnpm dev:login                 # 默认 ingest-dev@local.test
 *   pnpm dev:login you@example.org
 * 然后在 http://localhost:3000/api/auth/signin 的 Email 栏填邮箱与验证码登录。
 *
 * 只允许对本地数据库或下面列出的测试库运行，会建管理员账号，绝不能对生产库执行。
 */

import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/** Supabase 测试库项目 ref（连接串用户名形如 postgres.<ref>） */
const TEST_DATABASE_REFS = ["lesgvmmlsbckbupcouou"];
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

function assertTestDatabase(databaseUrl: string | undefined) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL)
    throw new Error("dev-login 不能在生产环境运行");
  if (!databaseUrl) throw new Error("DATABASE_URL 未配置");
  const url = new URL(databaseUrl);
  const ref = decodeURIComponent(url.username).split(".")[1];
  if (!LOCAL_HOSTS.includes(url.hostname) && !(ref && TEST_DATABASE_REFS.includes(ref)))
    throw new Error(`DATABASE_URL 不是本地或测试库（host ${url.hostname}），拒绝运行`);
}

async function main() {
  assertTestDatabase(process.env.DATABASE_URL);
  const email = process.argv[2] || "ingest-dev@local.test";
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: email.split("@")[0], emailVerified: new Date(), isSystemAdmin: true },
      update: { isSystemAdmin: true, status: "ACTIVE" },
    });
    const code = String(randomInt(100000, 1000000));
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
    await prisma.verificationToken.create({
      data: { identifier: email, token: code, expires: new Date(Date.now() + 10 * 60 * 1000) },
    });
    console.log(`user: ${user.id} (${email}, isSystemAdmin)`);
    console.log(`code: ${code}（10 分钟内有效）`);
    console.log("登录：http://localhost:3000/api/auth/signin → Email");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});

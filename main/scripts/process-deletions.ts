/**
 * 账号注销清理脚本
 * 处理冷静期已过的待注销账号
 *
 * 使用方式：
 *   pnpm tsx scripts/process-deletions.ts
 *   或
 *   npx tsx scripts/process-deletions.ts
 *
 * 可选参数：
 *   --dry-run    只显示会被处理的账号，不实际执行
 *   --force      强制处理，忽略冷静期（仅用于测试）
 */

import { PrismaClient, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

// 冷静期天数
const COOLING_PERIOD_DAYS = 7;

// 命令行参数
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");

interface DeletionResult {
  userId: string;
  email: string | null;
  phoneNumber: string | null;
  deletionRequestedAt: Date | null;
  status: "processed" | "skipped" | "error";
  error?: string;
}

async function main() {
  console.log("=".repeat(60));
  console.log("账号注销清理脚本");
  console.log("=".repeat(60));
  console.log(`模式: ${isDryRun ? "🔍 预览模式 (dry-run)" : "🚀 执行模式"}`);
  console.log(`冷静期: ${COOLING_PERIOD_DAYS} 天`);
  console.log("");

  // 计算冷静期截止时间
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - COOLING_PERIOD_DAYS);

  // 查找需要处理的用户
  const usersToDelete = await prisma.user.findMany({
    where: {
      status: UserStatus.PENDING_DELETE,
      deletionRequestedAt: isForce ? { not: null } : { lte: cutoffDate },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      deletionRequestedAt: true,
      createdAt: true,
    },
  });

  console.log(`找到 ${usersToDelete.length} 个待处理账号`);
  console.log("");

  if (usersToDelete.length === 0) {
    console.log("✅ 没有需要处理的账号");
    await prisma.$disconnect();
    return;
  }

  const results: DeletionResult[] = [];

  for (const user of usersToDelete) {
    console.log("-".repeat(40));
    console.log(`用户 ID: ${user.id}`);
    console.log(`  名称: ${user.name || "(未设置)"}`);
    console.log(`  邮箱: ${user.email || "(未设置)"}`);
    console.log(`  手机: ${user.phoneNumber || "(未设置)"}`);
    console.log(
      `  申请时间: ${user.deletionRequestedAt?.toLocaleString("zh-CN")}`
    );
    console.log(`  注册时间: ${user.createdAt.toLocaleString("zh-CN")}`);

    if (isDryRun) {
      console.log(`  状态: ⏭️ 跳过 (dry-run 模式)`);
      results.push({
        userId: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        deletionRequestedAt: user.deletionRequestedAt,
        status: "skipped",
      });
      continue;
    }

    try {
      await processUserDeletion(user.id);
      console.log(`  状态: ✅ 已处理`);
      results.push({
        userId: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        deletionRequestedAt: user.deletionRequestedAt,
        status: "processed",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`  状态: ❌ 错误 - ${errorMessage}`);
      results.push({
        userId: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        deletionRequestedAt: user.deletionRequestedAt,
        status: "error",
        error: errorMessage,
      });
    }
  }

  // 打印总结
  console.log("");
  console.log("=".repeat(60));
  console.log("处理总结");
  console.log("=".repeat(60));
  console.log(`总计: ${results.length}`);
  console.log(
    `已处理: ${results.filter((r) => r.status === "processed").length}`
  );
  console.log(`跳过: ${results.filter((r) => r.status === "skipped").length}`);
  console.log(`错误: ${results.filter((r) => r.status === "error").length}`);

  await prisma.$disconnect();
}

/**
 * 处理单个用户的注销
 * 清除个人信息，释放手机号/邮箱，更新状态为 DELETED
 */
async function processUserDeletion(userId: string) {
  await prisma.$transaction(async (tx) => {
    // 1. 删除所有关联的 Session（确保已登出）
    await tx.session.deleteMany({
      where: { userId },
    });

    // 2. 删除所有关联的 Account（OAuth 登录记录）
    await tx.account.deleteMany({
      where: { userId },
    });

    // 3. 删除 API 密钥
    await tx.api_key.deleteMany({
      where: { user_id: userId },
    });

    // 4. 删除钱包 Nonce
    await tx.walletNonce.deleteMany({
      where: { userId },
    });

    // 5. 匿名化用户数据（保留 ID 用于业务数据关联）
    await tx.user.update({
      where: { id: userId },
      data: {
        name: `已注销用户_${userId.slice(-6)}`,
        email: null,
        emailVerified: null,
        image: null,
        phoneNumber: null,
        wechatAvatar: null,
        bio: null,
        ethAddress: null,
        status: UserStatus.DELETED,
      },
    });

    // 注意：以下数据保留但不删除（业务数据）
    // - cantonese_corpus_update_history（标注历史）
    // - user_corpus_interactions（交互记录）
  });
}

// 运行脚本
main().catch((error) => {
  console.error("脚本执行失败:", error);
  process.exit(1);
});

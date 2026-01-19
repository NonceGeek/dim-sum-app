import {
  PrismaClient,
  Role,
  CorpusPermission,
  PermissionAction,
} from "@prisma/client";

const prisma = new PrismaClient();

export interface UserContext {
  id: string;
  role: Role;
  isSystemAdmin: boolean;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * 权限级别层级（数值越大权限越高）
 */
const PERMISSION_LEVELS: Record<CorpusPermission, number> = {
  [CorpusPermission.READ]: 1,
  [CorpusPermission.WRITE]: 2,
  [CorpusPermission.CREATE]: 3,
  [CorpusPermission.FULL]: 4,
};

/**
 * 检查用户是否可以对语料库执行指定操作
 */
export async function checkCorpusPermission(
  user: UserContext,
  categoryName: string,
  requiredPermission: CorpusPermission,
): Promise<PermissionCheckResult> {
  // 超级管理员拥有全部权限
  if (user.isSystemAdmin) {
    return { allowed: true };
  }

  // 获取分类信息
  const category = await prisma.cantonese_categories.findFirst({
    where: { name: categoryName },
  });

  if (!category) {
    return { allowed: false, reason: "Category not found" };
  }

  // 学习者只能查看公开语料库
  if (user.role === Role.LEARNER) {
    if (!category.is_public) {
      return { allowed: false, reason: "This corpus is not public" };
    }
    if (requiredPermission !== CorpusPermission.READ) {
      return { allowed: false, reason: "Learners can only view content" };
    }
    return { allowed: true };
  }

  // 检查用户-语料库权限绑定
  const permission = await prisma.user_corpus_permissions.findUnique({
    where: {
      user_id_category_name: {
        user_id: user.id,
        category_name: categoryName,
      },
    },
  });

  if (!permission) {
    // 如果是公开语料库且只需要读取权限，允许
    if (category.is_public && requiredPermission === CorpusPermission.READ) {
      return { allowed: true };
    }
    return { allowed: false, reason: "No permission for this corpus" };
  }

  // 检查权限级别
  if (
    PERMISSION_LEVELS[permission.permission] >=
    PERMISSION_LEVELS[requiredPermission]
  ) {
    return { allowed: true };
  }

  return { allowed: false, reason: "Insufficient permission level" };
}

/**
 * 检查用户是否可以新增语料库分类（仅超级管理员和研究员）
 */
export function canCreateCategory(user: UserContext): boolean {
  return user.isSystemAdmin || user.role === Role.RESEARCHER;
}

/**
 * 检查用户是否可以删除内容（仅超级管理员）
 */
export function canDelete(user: UserContext): boolean {
  return user.isSystemAdmin;
}

/**
 * 检查用户是否可以修改公开状态（仅超级管理员）
 */
export function canModifyPublicStatus(user: UserContext): boolean {
  return user.isSystemAdmin;
}

/**
 * 根据用户角色获取默认权限级别
 */
export function getDefaultPermissionForRole(role: Role): CorpusPermission {
  switch (role) {
    case Role.RESEARCHER:
      return CorpusPermission.CREATE;
    case Role.TAGGER_PARTNER:
    case Role.TAGGER_OUTSOURCING:
      return CorpusPermission.WRITE;
    case Role.LEARNER:
    default:
      return CorpusPermission.READ;
  }
}

/**
 * 记录权限变更到审计日志
 */
export async function logPermissionChange(params: {
  operatorId: string;
  targetUserId: string;
  action: PermissionAction;
  categoryName?: string;
  oldValue?: object;
  newValue?: object;
}): Promise<void> {
  await prisma.permission_audit_logs.create({
    data: {
      operator_id: params.operatorId,
      target_user_id: params.targetUserId,
      action: params.action,
      category_name: params.categoryName,
      old_value: params.oldValue as object | undefined,
      new_value: params.newValue as object | undefined,
    },
  });
}

/**
 * 获取用户在指定语料库的权限
 */
export async function getUserCorpusPermission(
  userId: string,
  categoryName: string,
): Promise<CorpusPermission | null> {
  const permission = await prisma.user_corpus_permissions.findUnique({
    where: {
      user_id_category_name: {
        user_id: userId,
        category_name: categoryName,
      },
    },
  });
  return permission?.permission ?? null;
}

/**
 * 获取用户有权限的所有语料库列表
 */
export async function getUserCorpusList(userId: string): Promise<
  Array<{
    category_name: string;
    permission: CorpusPermission;
  }>
> {
  const permissions = await prisma.user_corpus_permissions.findMany({
    where: { user_id: userId },
    select: {
      category_name: true,
      permission: true,
    },
  });
  return permissions;
}

/**
 * 获取语料库的所有授权用户列表
 */
export async function getCorpusUserList(categoryName: string): Promise<
  Array<{
    user_id: string;
    permission: CorpusPermission;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      role: Role;
    };
  }>
> {
  const permissions = await prisma.user_corpus_permissions.findMany({
    where: { category_name: categoryName },
    select: {
      user_id: true,
      permission: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });
  return permissions;
}

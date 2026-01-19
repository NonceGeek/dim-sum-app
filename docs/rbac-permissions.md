# 角色权限控制 (RBAC) 系统

本文档介绍 dim-sum-app 的角色权限控制系统，包括用户角色、语料库权限绑定、API 接口和管理界面。

## 角色与权限矩阵

| 角色                              | 新增语料库 | 新增词条 | 修改词条 | 删除词条 | 查看 | 作用范围     |
| --------------------------------- | ---------- | -------- | -------- | -------- | ---- | ------------ |
| 超级管理员 (`isSystemAdmin=true`) | ✅         | ✅       | ✅       | ✅       | ✅   | 全部语料库   |
| 研究员 (RESEARCHER)               | ✅         | ✅       | ✅       | ❌       | ✅   | 指定语料库   |
| 合作标注员 (TAGGER_PARTNER)       | ❌         | ❌       | ✅       | ❌       | ✅   | 指定语料库   |
| 外包标注员 (TAGGER_OUTSOURCING)   | ❌         | ❌       | ✅       | ❌       | ✅   | 指定语料库   |
| 学习者 (LEARNER)                  | ❌         | ❌       | ❌       | ❌       | ✅   | 仅公开语料库 |

## 数据库表结构

### 权限级别枚举 (CorpusPermission)

```prisma
enum CorpusPermission {
  READ   // 仅查看
  WRITE  // 可修改词条
  CREATE // 可新增词条+修改
  FULL   // 全部操作
}
```

### 用户-语料库权限绑定表 (user_corpus_permissions)

```prisma
model user_corpus_permissions {
  id            BigInt           @id @default(autoincrement())
  user_id       String
  category_name String
  permission    CorpusPermission @default(READ)
  created_at    DateTime         @default(now())
  updated_at    DateTime         @default(now()) @updatedAt
  created_by    String?          // 分配权限的管理员ID

  @@unique([user_id, category_name])
}
```

### 语料库公开状态 (cantonese_categories.is_public)

- `is_public = true`: 所有用户可查看
- `is_public = false`: 仅有权限的用户可查看和操作

### 审计日志表 (permission_audit_logs)

记录所有权限变更操作：

```prisma
model permission_audit_logs {
  id             BigInt           @id @default(autoincrement())
  operator_id    String           // 操作者
  target_user_id String           // 目标用户
  category_name  String?          // 涉及的语料库
  action         PermissionAction // GRANT/REVOKE/MODIFY/ROLE_CHANGE
  old_value      Json?
  new_value      Json?
  created_at     DateTime         @default(now())
}
```

## API 接口

### 权限管理 API

**端点**: `/api/admin/corpus/permissions`

| 方法   | 功能          | 参数                                     |
| ------ | ------------- | ---------------------------------------- |
| GET    | 获取权限列表  | `user_id` 或 `category_name`             |
| POST   | 分配/更新权限 | `{ user_id, category_name, permission }` |
| DELETE | 撤销权限      | `user_id`, `category_name`               |

**示例**:

```bash
# 分配权限
curl -X POST /api/admin/corpus/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "category_name": "zyzdv2",
    "permission": "WRITE"
  }'

# 查询用户权限
curl "/api/admin/corpus/permissions?user_id=user123"

# 撤销权限
curl -X DELETE "/api/admin/corpus/permissions?user_id=user123&category_name=zyzdv2"
```

### 分类管理 API

**端点**: `/api/admin/categories`

| 方法  | 功能         | 参数                  |
| ----- | ------------ | --------------------- |
| GET   | 获取分类列表 | `search` (可选)       |
| PATCH | 更新公开状态 | `{ name, is_public }` |

### 审计日志 API

**端点**: `/api/admin/audit-logs`

| 方法 | 功能     | 参数                                                                |
| ---- | -------- | ------------------------------------------------------------------- |
| GET  | 查询日志 | `operator_id`, `target_user_id`, `category_name`, `limit`, `offset` |

## 权限检查工具

位置: `lib/permission.ts`

### 主要函数

```typescript
// 检查用户对语料库的操作权限
checkCorpusPermission(user, categoryName, requiredPermission)
  -> Promise<{ allowed: boolean; reason?: string }>

// 检查是否可以新增语料库（仅超级管理员和研究员）
canCreateCategory(user) -> boolean

// 检查是否可以删除内容（仅超级管理员）
canDelete(user) -> boolean

// 检查是否可以修改公开状态（仅超级管理员）
canModifyPublicStatus(user) -> boolean

// 记录权限变更到审计日志
logPermissionChange({ operatorId, targetUserId, action, categoryName, oldValue, newValue })
```

### 使用示例

```typescript
import { checkCorpusPermission } from "@/lib/permission";
import { CorpusPermission } from "@prisma/client";

// 在 API 路由中检查权限
const permissionCheck = await checkCorpusPermission(
  {
    id: session.user.id,
    role: session.user.role,
    isSystemAdmin: session.user.isSystemAdmin,
  },
  categoryName,
  CorpusPermission.WRITE,
);

if (!permissionCheck.allowed) {
  return NextResponse.json({ error: permissionCheck.reason }, { status: 403 });
}
```

## 管理后台页面

| 页面        | 路径                 | 功能                           |
| ----------- | -------------------- | ------------------------------ |
| Categories  | `/admin/categories`  | 语料库分类管理，is_public 开关 |
| Permissions | `/admin/permissions` | 用户-语料库权限绑定管理        |
| Audit Logs  | `/admin/audit-logs`  | 权限变更审计日志查看           |

### Permissions 页面展示逻辑

**展示内容**：只展示 `user_corpus_permissions` 表中**显式分配的权限绑定**记录，包括 READ、WRITE、CREATE、FULL 所有级别。

**不展示的内容**：

- 对于公开语料库 (`is_public = true`) 的**隐式 READ 权限不会显示**
- 学习者 (LEARNER) 可以查看公开语料库，但如果没有显式分配权限，也不会出现在列表中

**总结**：该页面展示的是"谁被显式授予了哪些语料库的什么级别权限"，而非"谁能访问什么语料库"。

## 权限检查流程

```
用户请求 -> 检查登录状态
           |
           v
       是否超级管理员? --是--> 允许
           |
          否
           v
       是否学习者? --是--> 仅允许查看公开语料库
           |
          否
           v
       查询 user_corpus_permissions 表
           |
           v
       权限级别 >= 所需级别? --是--> 允许
           |
          否
           v
         拒绝
```

## 弃用字段

以下字段已弃用，保留但不再使用：

- `cantonese_categories.editable_level` - 使用 `user_corpus_permissions` 替代
- `cantonese_categories.taggers` - 使用 `user_corpus_permissions` 替代

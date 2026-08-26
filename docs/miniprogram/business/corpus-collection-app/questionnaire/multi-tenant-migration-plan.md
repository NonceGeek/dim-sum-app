# 问卷能力多租户迁移实施计划

> 状态：未来迁移执行基线，不属于当前单租户 V1 交付
> 业务与接口负责人：Fynn
> 源仓库：`/Users/fun/Documents/GitHub/dimsum-app`
> 目标仓库：`/Users/fun/Documents/GitHub/corpus-collection-saas`
> 更新时间：2026-08-20

## 1. 文档目的

本文用于未来把参赛前问卷、活动投稿门禁、旅程事件和问卷洞察从单租户 `dimsum-app` 迁移到多租户 `corpus-collection-saas`。

本文不是当前开发任务，也不授权在目标仓库提前实现。启动迁移时，应先以目标仓库当时的代码和 schema 重新核对本文，再建立正式变更单。

业务定义继续沿用：

- [参赛前问卷业务规则](./questionnaire-business-rules.md)
- [小程序接口契约](./questionnaire-miniprogram-api.md)
- [单租户实施计划](./implementation-plan.md)

多租户迁移不得改变以下产品语义：

- 活动标签与用户兴趣类型严格分离。
- 兴趣类型选填、多选。
- 问卷档案不可由用户查看、修改或删除。
- 手机号复用认证系统真源，未绑定时短信验证。
- 首页只有三张 KPI。
- 首次登记与资料复用使用两条独立路径。
- 活动投稿必须通过服务端问卷门禁。

## 2. 迁移目标与非目标

### 2.1 目标

- 每个租户拥有独立的问卷档案、旅程、事件、授权和导出数据。
- 小程序 API 请求与响应保持兼容。
- 租户只由 AppID、JWT 和后台会话解析，不接受客户端指定。
- 所有查询、写入、聚合、缓存、导出和审计均强制租户隔离。
- 保留单租户历史档案与事件，迁移后 KPI 可复算。
- 支持同一全局用户在多个租户下拥有不同问卷档案。
- 迁移可灰度、可核对、可回滚，且不在请求链路做跨库分布式事务。

### 2.2 非目标

- 不在迁移时改造成通用问卷搭建器。
- 不允许租户自定义问卷字段；字段版本管理另行立项。
- 不向小程序暴露 `tenantId`。
- 不跨租户合并问卷档案、用户兴趣或活动数据。
- 不把手机号复制到问卷表或分析导出。
- 不将单租户 PostgreSQL 表原样照搬到 D1，而忽略 SQLite 和租户索引特点。

## 3. 目标仓库现状基线

截至 2026-08-20，`corpus-collection-saas` 使用：

- Hono + Cloudflare Workers 服务端。
- Drizzle ORM + Cloudflare D1/SQLite。
- `apps/server/src/db/schema` 管理业务表。
- `apps/server/src/corpus-collection/services` 管理语料采集领域逻辑。
- `apps/server/src/handlers` 暴露小程序 HTTP API。
- TanStack Start Web Admin。

已有多租户能力：

| 能力 | 已有实现 |
|---|---|
| 租户 | `tenants` |
| 后台成员 | `tenant_memberships` |
| 小程序用户 | `tenant_users`、`tenant_user_channels` |
| 小程序配置 | `tenant_miniprogram_clients`，AppID 全局唯一 |
| 小程序认证 | JWT 包含 `tenantId`、`miniprogramClientId`、`userId` |
| 后台权限 | `tenant_menu_permissions`、`requireTenantPermission` |
| 审计 | `tenant_audit_logs` |
| 活动与投稿 | 所有核心表已有 `tenantId`，唯一约束和索引按租户组合 |
| 历史映射 | 活动、投稿等表已有 `legacyId` |

因此迁移重点不是新建租户框架，而是让问卷能力遵循现有框架。

## 4. 接口兼容原则

### 4.1 小程序接口

保持以下路径、请求字段和响应字段不变：

```text
POST /api/miniprogram/corpus_collection/questionnaire/entry
POST /api/miniprogram/corpus_collection/questionnaire/events
POST /api/miniprogram/corpus_collection/questionnaire/phone/send-code
POST /api/miniprogram/corpus_collection/questionnaire/submit
POST /api/miniprogram/corpus_collection/questionnaire/enter-submission
POST /api/miniprogram/corpus_collection/submissions
```

客户端继续只提交 `activityId`、`journeyId`、问卷答案和幂等键，不提交：

- `tenantId`
- `miniprogramClientId`
- `userId`
- `phoneNumber` 以外的身份映射信息

### 4.2 租户上下文来源

认证问卷接口必须从 access token 得到：

```ts
type MiniprogramTokenPayload = {
  tenantId: string;
  miniprogramClientId: string;
  userId: string;
  openId?: string;
  unionId?: string;
  phoneNumber?: string;
};
```

每次请求还必须重新确认：

1. `tenantId` 对应租户仍为 active。
2. `miniprogramClientId` 仍为 active。
3. client 属于 token 中的 tenant。
4. `tenant_users(tenantId, userId)` 仍为 active。
5. 请求活动属于同一 tenant。

不能只验证 JWT 签名后直接相信历史租户状态。

### 4.3 公开活动上下文

活动读取等公开接口继续通过 `x-miniprogram-app-id` 或约定的 AppID 参数解析租户。问卷接口全部要求登录，不使用匿名租户上下文。

## 5. 数据模型映射

目标表放在：

```text
apps/server/src/db/schema/corpus-collection-questionnaire.ts
```

也可以合并到现有 `corpus-collection.ts`，但若该文件届时已过长，应使用独立 schema 文件并从 schema index 导出。

所有 ID 使用目标仓库惯用的 text UUID。所有时间使用 D1 integer timestamp。所有索引以 `tenantId` 为第一列。

### 5.1 问卷档案

目标表：`corpus_collection_questionnaire_profiles`。

| 字段 | D1 类型 | 约束与说明 |
|---|---|---|
| `id` | text | UUID 主键 |
| `tenantId` | text | 必填，FK `tenants.id`，级联删除 |
| `legacyId` | integer? | 单租户来源主键，只用于迁移追踪 |
| `userId` | text | 必填，FK 全局 user |
| `schemaVersion` | integer | 必填 |
| `ageRange` | text | 必填枚举 |
| `cultureRegion` | text | 必填枚举 |
| `interestTypes` | JSON text | 兼容接口的原始兴趣数组 |
| `sourceActivityId` | text? | 同租户 activity |
| `completedAt` | timestamp | 必填 |
| `createdAt` | timestamp | 必填 |

唯一约束：

```text
UNIQUE(tenant_id, user_id)
UNIQUE(tenant_id, legacy_id)
```

同一全局用户在不同租户下允许各有一份档案。

### 5.2 兴趣类型明细

D1 中对 JSON 数组做跨租户聚合和索引不够稳定，不能只依赖 `interestTypes` JSON。新增规范化表：`corpus_collection_questionnaire_profile_interests`。

| 字段 | D1 类型 | 约束与说明 |
|---|---|---|
| `id` | text | UUID 主键 |
| `tenantId` | text | 必填 |
| `profileId` | text | 必填，FK profile，级联删除 |
| `interestType` | text | 必填枚举 |
| `createdAt` | timestamp | 必填 |

唯一约束：

```text
UNIQUE(tenant_id, profile_id, interest_type)
```

写入档案时同一 D1 事务或原子 batch 同时写 JSON 和明细表。JSON 用于接口和迁移对照，明细表用于画像聚合。

### 5.3 参赛旅程

目标表：`corpus_collection_questionnaire_journeys`。

| 字段 | D1 类型 | 约束与说明 |
|---|---|---|
| `id` | text | 保留源 UUID，主键 |
| `tenantId` | text | 必填 |
| `entryClientEventId` | text | 必填 UUID |
| `userId` | text | 必填 |
| `activityId` | text | 活动投稿必填；自由投稿为空 |
| `flowType` | text | full_questionnaire/phone_only/reused |
| `registrationType` | text | first_time/reused |
| `schemaVersion` | integer? | 问卷版本 |
| `status` | text | 状态机枚举 |
| `startedAt` | timestamp | 必填 |
| `completedAt` | timestamp? | 资料完成时间 |
| `enteredSubmissionAt` | timestamp? | 进入投稿时间 |
| `submissionId` | text? | 同租户投稿 |
| `expiresAt` | timestamp | 必填 |
| `createdAt` / `updatedAt` | timestamp | 必填 |

唯一约束：

```text
UNIQUE(tenant_id, entry_client_event_id)
```

重要索引：

```text
(tenant_id, user_id, activity_id, started_at)
(tenant_id, activity_id, flow_type, started_at)
(tenant_id, status, expires_at)
```

### 5.4 旅程事件

目标表：`corpus_collection_questionnaire_events`。

| 字段 | D1 类型 | 约束与说明 |
|---|---|---|
| `id` | text | UUID 主键 |
| `tenantId` | text | 必填 |
| `eventId` | text | 保留源 event UUID |
| `journeyId` | text | 必填，同租户 journey |
| `userId` | text | 必填，聚合冗余字段 |
| `activityId` | text | 活动投稿填写；自由投稿为空，聚合冗余字段 |
| `eventName` | text | 标准事件枚举 |
| `flowType` | text | 旅程路径快照 |
| `occurredAt` | timestamp | 必填 |
| `metadata` | JSON text | 白名单非敏感字段 |

唯一约束：

```text
UNIQUE(tenant_id, event_id)
```

重要索引：

```text
(tenant_id, activity_id, event_name, occurred_at)
(tenant_id, user_id, activity_id, event_name, occurred_at)
(tenant_id, journey_id, occurred_at)
```

### 5.5 活动级权限

目标表：`corpus_collection_activity_permissions`。

| 字段 | D1 类型 | 约束与说明 |
|---|---|---|
| `id` | text | UUID 主键 |
| `tenantId` | text | 必填 |
| `userId` | text | 被授权后台成员 |
| `activityId` | text | 同租户活动 |
| `canViewInsights` | boolean integer | 查看聚合看板 |
| `canExportInsights` | boolean integer | 导出聚合报表 |
| `assignedBy` | text? | 操作管理员 |
| `createdAt` / `updatedAt` | timestamp | 必填 |

唯一约束：

```text
UNIQUE(tenant_id, user_id, activity_id)
```

此表只缩小活动范围，不替代租户成员和菜单权限。

### 5.6 导出任务

目标表：`corpus_collection_questionnaire_export_jobs`。

关键字段：

- `tenantId`、`operatorUserId`
- `format`、`filters`
- `status`、`rowCount`、`errorCode`
- `storageObjectId` 或对象 key
- `createdAt`、`completedAt`、`expiresAt`

唯一和查询索引必须包含 `tenantId`。文件存入租户隔离的对象 key，并接入 `tenant_storage_objects` 或届时统一的租户存储台账。

### 5.7 审计日志

目标仓库不新增问卷专用审计表，复用 `tenant_audit_logs`：

```text
tenantId       = 当前租户
actorUserId    = 当前后台用户
visibility     = tenant
resourceType   = questionnaire_insights | questionnaire_export | activity_permission
resourceId     = activityId 或 exportJobId
metadata       = 去敏筛选、结果行数、状态；不含 UID、手机号、验证码或答案
```

建议 action：

- `questionnaire.insights.view`
- `questionnaire.insights.export_requested`
- `questionnaire.insights.export_downloaded`
- `questionnaire.activity_permission.granted`
- `questionnaire.activity_permission.updated`
- `questionnaire.activity_permission.revoked`

## 6. 跨表租户不变量

D1 外键无法表达所有复合租户约束，服务层必须显式验证：

```text
profile.tenantId == token.tenantId
journey.tenantId == token.tenantId
activity.tenantId == journey.tenantId
event.tenantId == journey.tenantId
submission.tenantId == journey.tenantId
submission.activityId == journey.activityId
permission.tenantId == adminSession.tenantId
permission.activityId belongs to permission.tenantId
```

任何 service 方法都把 `tenantId` 作为必填首要输入，并在同一查询条件中同时使用 tenant 和资源 ID：

```ts
and(eq(table.tenantId, tenantId), eq(table.id, resourceId))
```

禁止先只按 ID 读取，再在应用层补查 tenant。

## 7. 服务与 Handler 迁移

建议目标文件：

```text
apps/server/src/corpus-collection/services/questionnaire-schema.ts
apps/server/src/corpus-collection/services/questionnaire-journeys.ts
apps/server/src/corpus-collection/services/questionnaire-phone-binding.ts
apps/server/src/corpus-collection/services/questionnaire-insights.ts
apps/server/src/corpus-collection/services/questionnaire-exports.ts
apps/server/src/handlers/miniprogram-questionnaire.ts
```

每个 service 输入显式包含：

```ts
{
  tenantId: string;
  userId: string;
  miniprogramClientId: string;
}
```

`miniprogramClientId` 仅在需要核对渠道或短信策略时使用，不写入问卷答案。

投稿服务 `miniprogram-submissions.ts` 增加问卷旅程校验，并在创建投稿的同一原子操作中更新 journey 和写成功事件。

## 8. 手机号与用户身份

- 不把 token 中的 `phoneNumber` 当作永久真源；它可能是签发时快照。
- 提交时重新读取目标仓库的认证/用户渠道数据确认手机号状态。
- 无手机号时复用目标仓库已有的小程序短信登录/验证服务和频率限制。
- 验证码 namespace 必须包含 tenant、user 和用途：

```text
questionnaire-bind:<tenantId>:<userId>:<phoneNumber>
```

- 同一手机号在不同租户下的账户语义遵循目标仓库当时的身份模型，不从单租户直接复制账号合并规则。
- 任何用户合并都只能移动当前租户的 profile、journey、event 和 submission 关系。
- 如果源用户和目标用户在同一租户都已有 profile，停止自动合并，写租户审计并进入人工处理；不得覆盖答案。

## 9. 后台权限模型

后台访问需依次满足：

1. active `tenant_memberships`。
2. `tenant_menu_permissions(menuKey = analytics, canView = true)`。
3. 显式活动范围与 `corpus_collection_activity_permissions` 的交集。

导出还需：

```text
tenant_menu_permissions.analytics.canEdit = true
activity_permission.canExportInsights = true
```

`tenant_owner` 是否绕过活动级权限必须在迁移启动时确认。建议：

- tenant owner/admin 可看全部租户活动。
- tenant member 必须逐活动授权。
- platform admin 必须先选择 tenant context，不能执行跨租户聚合。

权限失败返回 403，并写不含敏感筛选内容的拒绝审计。

## 10. 聚合与 D1 性能方案

### 10.1 第一阶段

- 原始 profile、interest、journey、event、submission 为事实真源。
- 小租户可直接按索引查询。
- 缓存 key 必须包含 `tenantId`、授权活动集合哈希和全部筛选参数。
- 不得缓存一个租户的响应供另一个租户使用。

### 10.2 预聚合触发条件

满足任一条件时启用按日聚合：

- 单租户问卷事件超过 100,000。
- Overview p95 超过 1 秒。
- D1 查询行数或 CPU 接近套餐限制。
- 聚合导出影响在线请求。

建议表：`corpus_collection_questionnaire_daily_aggregates`，至少包含：

```text
tenantId + date + activityId + flowType + dimensionType + dimensionValue
```

聚合任务由 Cloudflare Cron 运行，使用水位和幂等 upsert。最近自然日允许重算，已封账日期只能由修复任务重算。

### 10.3 小样本保护

- 样本阈值按当前租户、当前授权活动和当前筛选计算。
- 小于 10 的分组不返回精确率。
- 多次相邻筛选可能产生差分攻击，导出和下钻需要最小时间粒度、最大筛选组合或查询频率限制。
- 抑制必须在服务端聚合层完成。

## 11. 历史数据迁移

### 11.1 前置条件

- 单租户 V1 已稳定运行并冻结 `schemaVersion`。
- 目标 tenant、miniprogram client、活动和投稿主体已迁移。
- 已有活动 `legacyId` 映射完整且唯一。
- 已确定用户身份映射方案。
- 迁移工具支持 dry-run、断点续跑、幂等 upsert 和校验报告。

### 11.2 身份映射

禁止按昵称、头像或模糊手机号匹配用户。优先顺序：

1. 复用语料采集主体迁移时已经建立的旧 `User.id` → SaaS `user.id` 映射。
2. 使用确定性的 provider account，例如同一微信 unionId/openId 加 client 映射。
3. 使用已验证手机号映射，但必须遵守目标租户身份规则并处理冲突。
4. 无法确定的用户进入隔离清单，不能自动挂到相似账号。

临时映射文件或表包含敏感身份信息时必须加密、限制访问，并在迁移验收后按安全流程销毁。

### 11.3 ID 映射

| 单租户 | SaaS |
|---|---|
| activity BigInt | 通过 `(tenantId, activity.legacyId)` 找 text ID |
| submission BigInt | 通过 `(tenantId, submission.legacyId)` 找 text ID |
| profile BigInt | 生成 text UUID，保留 `legacyId` |
| journey UUID | 原值保留，同 tenant 唯一 |
| event UUID | 原值保留，同 tenant 唯一 |
| user String | 通过确定性身份映射转换 |

### 11.4 导入顺序

```text
tenant/client/user/activity/submission 主体
  -> questionnaire_profiles
  -> questionnaire_profile_interests
  -> questionnaire_journeys
  -> questionnaire_events
  -> journey.submissionId 回填
  -> activity permissions
  -> export/audit 不迁移或按合规决定
```

### 11.5 增量同步

不建议在业务请求中同步写 PostgreSQL 和 D1。使用独立、可重试的迁移作业：

- profile：按 `created_at` 水位增量，内容不可变。
- event：按 `id/occurred_at` 水位增量，幂等写入。
- journey：按 `updated_at` 增量 upsert，保证状态最终一致。
- submission 归因：复用投稿主体迁移水位后回填。

每轮作业保存 source watermark、target count、失败记录和校验摘要。

## 12. 校验与对账

### 12.1 结构校验

- 每个源 profile 有且只有一个目标 profile。
- interest JSON 展开数量等于明细表数量。
- 每个 event 的 journey、user、activity 均存在且同租户。
- 每个 submitted journey 的 submission 映射存在。
- 无跨租户外键和孤儿数据。

### 12.2 数量校验

按 tenant、日期、活动比较：

- profile 总数。
- 三种 flow 数量。
- 各 eventName 数量和去重 UV。
- 成功投稿归因数量。
- 年龄、地区、兴趣、活动标签分布。

### 12.3 指标校验

在同一时间范围和活动范围下，单租户与 SaaS 应一致：

- 已完成参赛前登记。
- 登记后投稿率。
- 资料复用率。
- 首次登记漏斗。
- 资料复用路径。
- 活动对比问卷完成率。

整数指标要求完全一致。百分比允许的唯一差异来自统一约定的四舍五入，不接受统计口径差异。

## 13. 切换方案

### 13.1 阶段 A：目标能力准备

- 部署 D1 migration。
- 实现服务、handler、权限、审计和测试。
- 目标 API 保持关闭或仅测试租户可用。

### 13.2 阶段 B：全量回填

- 从单租户数据库生成一致性快照。
- 运行 dry-run 和正式导入。
- 输出身份冲突、孤儿数据和指标对账报告。

### 13.3 阶段 C：增量追平

- 周期性同步新增 profile/event 和变化 journey。
- 对关键活动进行双端只读指标比较。
- 不让小程序同时向两个后端写入。

### 13.4 阶段 D：灰度切流

- 选择测试 AppID 或测试 tenant。
- 将该 AppID 路由到 SaaS 后端。
- 验证登录、短信、问卷、投稿门禁、看板和导出。
- 再按 AppID/tenant 扩大范围。

### 13.5 阶段 E：正式切换

- 短维护窗口内暂停源问卷写入。
- 运行最后一次增量同步和对账。
- 切换生产 AppID 路由。
- 源系统问卷入口改为只读或关闭。
- 保留源数据用于限定时间的审计与回滚。

## 14. 回滚方案

满足以下任一情况立即停止扩大灰度：

- 出现跨租户数据泄露或资源串租户。
- 短信验证或身份映射产生错误账号关联。
- 投稿门禁误放行或大面积误拦截。
- 核心 KPI 无法与源系统对账。
- D1 性能无法满足活动峰值。

回滚步骤：

1. 将受影响 AppID 路由切回单租户后端。
2. 暂停 SaaS 问卷和投稿写入。
3. 导出灰度期间只写入 SaaS 的 profile、journey、event、submission 清单。
4. 通过受控反向迁移补回源系统，不能直接覆盖已有记录。
5. 复核用户和手机号关联后恢复服务。

迁移前必须演练反向迁移；仅有代码回滚而没有数据回滚不算可回滚。

## 15. 测试矩阵

### 15.1 租户隔离

- Tenant A token 访问 Tenant B activity 返回 404 或 403，不泄露资源存在性。
- 同一 `clientEventId` 在不同 tenant 可分别使用；同 tenant 必须幂等。
- 同一全局 user 可在 A/B tenant 分别创建 profile。
- A tenant 的 journey 不能用于 B tenant 投稿。
- A tenant 的活动运营不能看到 B tenant 活动或筛选选项。
- 缓存、导出和对象 key 不跨 tenant。

### 15.2 权限

- 无 membership、disabled membership 拒绝。
- analytics 无 canView 拒绝看板。
- 有菜单权限但无活动授权时只能看到空授权范围或返回明确拒绝。
- canView 无 canExport 时导出拒绝。
- tenant owner/admin 与 member 的绕过规则符合最终决策。
- platform admin 必须选择 tenant context。

### 15.3 问卷与手机号

- 三种 flow 在每个 tenant 独立判定。
- JWT 手机号快照与数据库状态不一致时以数据库为准。
- 验证码不能跨 tenant、user 或用途复用。
- 同租户双 profile 合并冲突进入人工处理。

### 15.4 数据与分析

- JSON interest 与明细表原子一致。
- 小样本阈值按 tenant 生效。
- 三 KPI、两条路径和活动对比按 tenant 对账。
- 导出文件不含 UID、手机号、姓名、验证码或答案明细。

## 16. 安全检查清单

- 所有 repository 查询包含 tenant 条件。
- 所有唯一索引包含 tenant，除全局 ID 本身必须全局唯一的情况。
- JWT tenant 与 miniprogram client tenant 每次校验。
- 活动、旅程、投稿的 tenant 关系在写入前校验。
- 错误响应不返回其他租户资源详情。
- 日志和审计 metadata 去敏。
- 导出文件按 tenant 隔离并短期签名访问。
- 临时身份映射数据受控并按期销毁。
- 租户缓存 key、Cron 水位和 migration checkpoint 全部带 tenant。

## 17. 迁移执行交付物

正式启动迁移时必须产出：

1. 目标仓库 OpenSpec/变更说明。
2. Drizzle schema 与 D1 migrations。
3. 小程序问卷服务和 handler。
4. Admin 权限、看板、导出与审计实现。
5. 数据迁移 CLI，支持 dry-run、resume 和 idempotent upsert。
6. 身份映射冲突报告。
7. 源/目标数量和 KPI 对账报告。
8. 租户隔离自动化测试。
9. 灰度、切换和回滚 Runbook。
10. 迁移完成后的数据保留和源系统下线记录。

## 18. 启动门槛与完成定义

### 启动门槛

- 单租户 V1 已上线且业务口径稳定。
- SaaS 目标仓库租户、认证、短信和活动投稿能力稳定。
- Fynn 确认接口没有未决破坏性变更。
- 已确定 tenant owner/admin 的活动权限规则。
- 已确定历史用户身份映射来源。
- 已完成生产级备份和回滚演练计划。

### 完成定义

- 全部目标租户数据完成迁移并通过结构、数量和指标对账。
- 小程序不改 `tenantId` 相关请求即可完成联调。
- 自动化测试证明不存在跨租户读写、缓存、导出或短信复用。
- 每个灰度租户均验证问卷、手机号、投稿和 Admin 洞察完整链路。
- 回滚演练成功，灰度期间新增数据可安全回迁。
- 源系统停止问卷写入后仍按合规要求保留或清理历史数据。

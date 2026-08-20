# 参赛前问卷与洞察看板实施计划

> 状态：单租户 V1 计划
> 业务与接口负责人：Fynn
> Web Admin UI 实施负责人：Fynn
> 更新时间：2026-08-20

## 1. 实施目标

在 `dimsum-app` 中先实现单租户参赛前问卷、短信验证、活动投稿门禁、旅程事件和后台聚合洞察。小程序客户端由独立团队实现；服务端接口与 Web Admin 均由 Fynn 负责设计、业务确认和实施。

未来将能力迁移到 `/Users/fun/Documents/GitHub/corpus-collection-saas`。本期只记录多租户实施方案，不修改该仓库。

业务口径以 [questionnaire-business-rules.md](./questionnaire-business-rules.md) 为准，小程序契约以 [questionnaire-miniprogram-api.md](./questionnaire-miniprogram-api.md) 为准。

## 2. 当前系统基线

`dimsum-app` 已具备：

- `User`、小程序 JWT 和 `requireMiniprogramAuth`。
- 唯一 `User.phoneNumber`。
- 阿里云短信验证码发送、手机号格式校验。
- 手机号绑定时的账号冲突检查和用户合并服务。
- 活动、投稿、活动标签、活动时间与投稿状态。
- `/api/miniprogram/corpus_collection/*` 接口。
- `/admin/corpus-collection` 后台与 `isSystemAdmin` 鉴权。
- 权限变更审计日志，但它不适合问卷导出和访问审计。

当前缺少：

- 不可变问卷档案。
- 参赛旅程和漏斗事件。
- 活动投稿的问卷门禁。
- 问卷洞察查询服务与页面。
- 活动级运营授权。
- 问卷导出任务和专用审计日志。

## 3. 单租户 V1 技术决策

### 3.1 数据真源

- 问卷档案、旅程、事件和投稿表是统计真源。
- 手机号只存 `User.phoneNumber`。
- 活动标签只存活动 `tags[0]`。
- 用户兴趣只存问卷档案 `interest_types`。
- V1 不创建预聚合表；先使用索引 SQL 和 5 分钟服务端缓存。
- 当事件量超过 100,000 或 Overview 查询 p95 超过 1 秒时，再引入按日预聚合任务，不改变 API。

### 3.2 服务端强制门禁

问卷是否完成、活动是否可投稿、旅程是否有效均由服务端判断。前端缓存只用于 UI，不具有授权意义。

### 3.3 不可变档案

小程序只允许首次创建，不提供 GET/PATCH/DELETE 用户答案接口。管理员也不在问卷洞察模块查看答案明细。

### 3.4 单租户边界

- 新表不增加 `tenant_id`。
- 小程序和 Admin 请求不接受 `tenantId`。
- 所有活动仍属于当前单一业务空间。
- 多租户字段和复合索引留到 SaaS 迁移时添加。

## 4. 数据模型计划

### 4.1 `corpus_collection_questionnaire_profiles`

每个用户一份不可变档案。

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | BigInt | 主键 |
| `user_id` | String | FK `User.id`，唯一 |
| `schema_version` | Int | V1 固定为 1 |
| `age_range` | String | 必填枚举 |
| `culture_region` | String | 必填枚举 |
| `interest_types` | Json | 字符串数组，默认 `[]` |
| `source_activity_id` | BigInt | 首次完成登记的活动 |
| `completed_at` | DateTime | 首次完整提交时间 |
| `created_at` | DateTime | 创建时间 |

索引：

- `UNIQUE(user_id)`
- `(completed_at)`
- `(source_activity_id, completed_at)`
- 表达式或后续查询需要的 `age_range`、`culture_region` 索引

档案创建后业务代码不得更新问卷答案。

### 4.2 `corpus_collection_questionnaire_journeys`

一次点击“我要投稿”对应一个旅程。

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | UUID | 主键，由服务端生成 |
| `entry_client_event_id` | UUID | 唯一，进入请求幂等键 |
| `user_id` | String | FK `User.id` |
| `activity_id` | BigInt | FK activity |
| `flow_type` | String | `full_questionnaire`、`phone_only`、`reused` |
| `registration_type` | String | `first_time`、`reused` |
| `schema_version` | Int? | 完整问卷旅程为 1 |
| `status` | String | `started`、`completed`、`entered_submission`、`submitted`、`cancelled`、`expired` |
| `started_at` | DateTime | 点击时间 |
| `completed_at` | DateTime? | 资料变完整时间 |
| `entered_submission_at` | DateTime? | 进入投稿页时间 |
| `submission_id` | BigInt? | 成功投稿后关联 |
| `expires_at` | DateTime | `started_at + 24h` |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 状态更新时间 |

索引：

- `UNIQUE(entry_client_event_id)`
- `(user_id, activity_id, started_at)`
- `(activity_id, flow_type, started_at)`
- `(status, expires_at)`

### 4.3 `corpus_collection_questionnaire_events`

保留旅程事实，不保存手机号、验证码或自由文本。

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | BigInt | 主键 |
| `event_id` | UUID | 唯一；客户端事件使用 `clientEventId`，服务端事件生成 UUID |
| `journey_id` | UUID | FK journey |
| `user_id` | String | 冗余保存，便于聚合 |
| `activity_id` | BigInt | 冗余保存，便于聚合 |
| `event_name` | String | 标准事件枚举 |
| `flow_type` | String | 旅程路径快照 |
| `occurred_at` | DateTime | 服务端接收时间或事务时间 |
| `metadata` | Json | 只允许白名单的非敏感字段 |

索引：

- `UNIQUE(event_id)`
- `(activity_id, event_name, occurred_at)`
- `(user_id, activity_id, event_name, occurred_at)`
- `(journey_id, occurred_at)`

### 4.4 `corpus_collection_activity_permissions`

由管理员配置活动运营的访问范围。

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | BigInt | 主键 |
| `user_id` | String | 被授权运营人员 |
| `activity_id` | BigInt | 被授权活动 |
| `can_view_insights` | Boolean | 查看聚合洞察 |
| `can_export_insights` | Boolean | 导出去标识化报表 |
| `assigned_by` | String | 管理员 UID |
| `created_at` / `updated_at` | DateTime | 审计时间 |

唯一约束：`(user_id, activity_id)`。

系统管理员和超级管理员不需要逐活动授权；普通运营无记录即拒绝。

该表同时作为活动运营进入 Corpus Collection Admin 的成员资格。只要用户至少有一条有效活动授权，即可进入 `/admin/corpus-collection/*`，但不能访问用户管理、全局权限和其他系统管理页面。

### 4.5 `corpus_collection_audit_logs`

不要复用要求 `target_user_id` 的 `permission_audit_logs`。

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | BigInt | 主键 |
| `operator_id` | String | 操作人 |
| `action` | String | 授权、查询详情、导出、查看联系方式等 |
| `activity_id` | BigInt? | 目标活动 |
| `filters` | Json | 去敏后的筛选条件 |
| `result_summary` | Json | 行数、任务 ID、成功/失败，不存敏感内容 |
| `created_at` | DateTime | 操作时间 |

### 4.6 导出任务

若 V1 实现 PRD 中的异步导出，新增 `corpus_collection_export_jobs`：

- `id`、`operator_id`、`format`、`filters`
- `status`：`queued/running/completed/failed/expired`
- `object_url` 或对象存储 key
- `row_count`、`error_code`
- `expires_at = completed_at + 24h`

导出文件只包含聚合行。

## 5. 服务层拆分

建议新增独立服务，避免把逻辑堆进 route：

```text
main/lib/services/questionnaire-schema.ts
main/lib/services/questionnaire-journey.ts
main/lib/services/questionnaire-phone-binding.ts
main/lib/services/questionnaire-insights.ts
main/lib/services/corpus-collection-access.ts
```

职责：

- `questionnaire-schema`：Schema、枚举、请求校验、响应序列化。
- `questionnaire-journey`：状态判定、幂等、旅程状态机、事件写入、投稿门禁。
- `questionnaire-phone-binding`：复用短信、验证码与 `mergeUserRelations`，使用小程序 JWT 用户而不是 Web session。
- `questionnaire-insights`：统一指标 SQL、时间口径、小样本保护和导出数据集。
- `corpus-collection-access`：系统管理员全量权限与活动级授权合并判断。

现有 `/admin` layout 会把所有非 `isSystemAdmin` 用户重定向到首页，必须同步改造：

- 新增 `requireCorpusCollectionAccess` 服务端鉴权，返回操作人的授权活动集合。
- Admin 外壳允许系统管理员，或至少拥有一条活动授权的活动运营进入。
- 对活动运营只展示 Corpus Collection 菜单，并限制路由前缀为 `/admin/corpus-collection`。
- 用户管理、管理员管理、全局权限、系统设置等页面继续只允许系统管理员。
- 页面隐藏不能替代 API 鉴权；每个查询和导出接口都必须再次校验活动范围。

## 6. 小程序接口实施

按 [questionnaire-miniprogram-api.md](./questionnaire-miniprogram-api.md) 实现：

```text
POST /api/miniprogram/corpus_collection/questionnaire/entry
POST /api/miniprogram/corpus_collection/questionnaire/events
POST /api/miniprogram/corpus_collection/questionnaire/phone/send-code
POST /api/miniprogram/corpus_collection/questionnaire/submit
POST /api/miniprogram/corpus_collection/questionnaire/enter-submission
```

修改：

```text
POST /api/miniprogram/corpus_collection/submissions
```

只对带 `activityId` 的投稿强制 `questionnaireJourneyId`。

手机号绑定必须抽出能同时接受 Web session 用户和小程序 JWT 用户的领域函数，不能让小程序调用 Web 专用 `/api/user/phone/bind`。

## 7. Admin 看板实施

### 7.0 UI 实施与设计约束

- Web Admin UI 由 Fynn 在本仓库实施，不再视为外部后台团队的交付项。
- 页面信息架构、模块顺序、内容层级、筛选器组合、三张 KPI、两条独立路径、画像区域、活动效果表和弹层布局，以 [问卷洞察看板 PRD](./s6-questionnaire-insights-dashboard-v2/s6-questionnaire-insights-dashboard-v2.md) 及其 [交互原型](./s6-questionnaire-insights-dashboard-v2/image-attachments/questionnaire-insights-admin-interactive-v6.html) 为布局基线。
- 原型只定义业务布局和交互，不直接复制其视觉样式。颜色、字体、字号、间距、圆角、阴影、图表色、暗色模式和交互状态必须使用项目现有 [Design System](../../../../design-system.md) 的语义 token。
- 优先复用 `main/components/ui` 中现有 shadcn/Radix 组件，以及现有 Admin 的侧边栏、Card、Table、Dialog、Select、Skeleton 和 Toast；不得在页面中硬编码品牌色或另建一套组件规范。
- 页面必须同时支持现有亮色和暗色主题，并满足键盘操作、焦点态、语义标题、图表文本替代和最小对比度要求。
- 若原型视觉与现有设计系统冲突：保持原型的信息架构和相对布局，视觉表现以现有设计系统为准。

### 7.1 路由与导航

页面：

```text
/[locale]/admin/corpus-collection/questionnaire-insights
```

导航标题：`Questionnaire Insights`。

活动详情页后续增加“问卷画像”入口，复用同一查询服务并固定 `activityId`。

### 7.2 Admin API

单租户 V1 不接受 `tenant_id`：

```text
GET  /api/admin/corpus-collection/questionnaire-insights/overview
GET  /api/admin/corpus-collection/questionnaire-insights/funnel-detail
GET  /api/admin/corpus-collection/questionnaire-insights/profile-detail
GET  /api/admin/corpus-collection/questionnaire-insights/activity-comparison
POST /api/admin/corpus-collection/questionnaire-insights/exports
GET  /api/admin/corpus-collection/questionnaire-insights/exports/:id
```

公共筛选：

- `dateStart`、`dateEnd`，最大 365 天。
- `activityId`。
- `submissionStatus = all | submitted | not_submitted`。
- `registrationType = all | first_time | reused`。

所有接口必须先把请求活动范围与操作人授权活动取交集。未授权的显式 `activityId` 返回 403，不能静默返回空数据。

### 7.3 指标和图表

- 首页严格三张 KPI。
- 首次登记漏斗与资料复用路径分开。
- 年龄、地区、兴趣类型是用户画像。
- 活动标签是活动维度。
- 活动对比继续显示问卷完成率，但不把它恢复为首页 KPI。
- 样本数小于 10 的组由 API 删除精确率并返回 `suppressed: true`。

### 7.4 查询性能

- 统一在 `questionnaire-insights` 服务生成指标，禁止每个路由自行复制公式。
- 第一阶段查询事件事实表并缓存 5 分钟。
- 当前自然日缓存可缩短到 1 分钟。
- 任何图表不得通过前端拿明细后聚合。

## 8. 分阶段交付

### 当前实施进度（2026-08-20）

- 已完成：先只读执行 `prisma db pull --print` 核对线上结构，再更新 Prisma schema，并通过 `prisma db push` 将问卷表同步到当前数据库；问卷 Schema/校验器、三种旅程状态、事件幂等和独立短信验证码命名空间已实现。
- 已完成：五个小程序问卷接口，以及由功能开关控制的活动投稿门禁；投稿与成功事件在同一数据库事务内完成。
- 已完成：活动级访问服务、专用访问审计、Overview 聚合接口和小样本率值抑制。
- 已完成首版：后台 Questionnaire Insights 页面、四项全局筛选、严格三张 KPI、首次登记/资料复用两条路径、年龄/地区/兴趣画像和活动效果表。
- 待实施：管理员活动授权配置入口、三个详情/对比接口及弹层、聚合导出、5 分钟缓存、自动化领域与指标测试。
- 已部署：问卷相关 schema 已通过 `prisma db push` 同步到当前数据库；门禁仍默认关闭，须完成小程序联调后按活动灰度开启。

### Phase 0：文档与口径冻结

- 业务规则、接口契约、数据模型和事件名称评审通过。
- 小程序团队确认状态机和错误码。
- Fynn 确认三 KPI、两条路径、原型布局和现有设计系统映射。

### Phase 1：数据库与领域服务

- 先 `prisma db pull` 同步数据库真源，更新 Prisma schema 后使用 `prisma db push` 推送；本项目当前不为该功能维护 migration 文件。
- 问卷 Schema 常量和验证器。
- 旅程状态机与事件服务。
- 小程序手机号绑定领域函数。
- 用户合并时迁移问卷 profile、journey、event 关系。

### Phase 2：小程序 API 与投稿门禁

- 五个问卷接口。
- 活动投稿增加旅程校验。
- 服务端事务写完成与投稿成功事件。
- 兼容普通非活动投稿。
- 输出小程序联调环境和示例。

### Phase 3：权限与聚合查询

- 活动权限表和管理员配置入口。
- Admin 外壳和导航支持活动运营的受限入口。
- `requireCorpusCollectionAccess` 与授权活动范围服务。
- 专用审计日志。
- Overview、漏斗、画像、活动对比查询服务。
- 小样本保护和 24 小时 cohort 口径。

### Phase 4：Admin 页面

- Fynn 负责页面实现与 UI 验收。
- 信息架构和模块布局与 PRD/交互原型一致。
- 视觉 token、基础组件、主题与交互状态与现有 Design System 一致。
- 三张 KPI。
- 两条路径。
- 年龄、地区、兴趣类型画像。
- 活动标签与活动效果表。
- 活动对比、空态、骨架屏和局部错误恢复。

### Phase 5：聚合导出

- 异步 CSV/XLSX 任务。
- 24 小时下载链接。
- 授权校验、小样本保护和审计。

### Phase 6：灰度与验收

- 先对测试活动启用问卷门禁。
- 校验事件与真实投稿记录。
- 对照 SQL 手工复算 KPI。
- 确认小程序隐私保护指引已配置手机号用途。
- 灰度稳定后再对全部活动启用。

## 9. 测试计划

### 9.1 领域测试

- 问卷枚举、必填和可选兴趣校验。
- 每用户唯一档案与重复提交幂等。
- 三种 `flowType` 判定。
- 旅程状态转换与 24 小时过期。
- 活动标签与兴趣类型完全分离。

### 9.2 手机号测试

- 已绑定手机号直接完成。
- 未绑定手机号发送频率和验证码有效期。
- 错误验证码不创建档案。
- 手机号冲突先要求确认，确认后合并。
- 用户合并后只保留目标用户的一份档案；发生双档案冲突时阻止自动覆盖并记录人工处理日志。

### 9.3 API 测试

- 所有接口鉴权。
- `clientEventId` 幂等。
- 非法旅程、跨用户、跨活动和过期旅程。
- 用户不能读取、更新或删除答案。
- 普通投稿兼容性。

### 9.4 指标测试

- 首次登记与复用路径不会倒挂。
- 24 小时边界和筛选区间边界。
- 同 UID、活动、自然日事件去重。
- 投稿只归因最近有效进入事件。
- 少于 10 人时不返回精确率。
- 三张 KPI 与活动对比问卷完成率口径独立。

### 9.5 权限与隐私测试

- 系统管理员全量权限。
- 活动运营只能访问授权活动。
- 未授权查询和导出返回 403 并审计。
- 响应、导出和日志不含完整手机号、验证码、UID 或答案明细。

## 10. 发布与回滚

建议使用服务端功能开关：

```text
QUESTIONNAIRE_GATE_ENABLED=false
QUESTIONNAIRE_GATE_ACTIVITY_IDS=<comma-separated activity ids>
```

发布顺序：

1. 先按 `db pull → 修改 schema → db push` 同步数据库结构，再部署只写不拦截的事件能力。
2. 部署问卷接口并与小程序联调。
3. 对测试活动启用门禁。
4. 校验数据后扩大活动范围。
5. 最后启用后台看板和导出。

回滚时关闭门禁开关，恢复原活动投稿链路；保留已写档案和事件，不做破坏性回滚。

## 11. 多租户后续实施计划

本节仅保留总体方向。未来迁移的规范性执行文档见 [multi-tenant-migration-plan.md](./multi-tenant-migration-plan.md)；若两处细节不一致，以独立迁移文档为准。

目标仓库：`/Users/fun/Documents/GitHub/corpus-collection-saas`。

该仓库已经具备：

- `tenants`、`tenant_memberships`、`tenant_users`。
- `tenant_miniprogram_clients`，可由小程序 AppID 解析租户。
- 小程序 JWT 中的 `tenantId`。
- 所有语料采集活动与投稿的 `tenantId` 隔离。
- `tenant_menu_permissions` 和 `tenant_audit_logs`。

### 11.1 Schema 迁移

在 SaaS 的每个问卷业务表增加必填 `tenantId`：

```text
questionnaire_profiles
questionnaire_journeys
questionnaire_events
activity_permissions
export_jobs
```

约束改为租户复合约束：

- Profile：`UNIQUE(tenant_id, user_id)`。
- 进入幂等：`UNIQUE(tenant_id, entry_client_event_id)`。
- 事件幂等：`UNIQUE(tenant_id, event_id)`。
- 活动授权：`UNIQUE(tenant_id, user_id, activity_id)`。
- 所有查询索引以 `tenant_id` 为第一列。

### 11.2 租户解析

- 游客活动接口通过请求 AppID 映射 `tenant_miniprogram_clients`。
- 登录后从租户级 JWT 读取 `tenantId`、`userId` 和 `miniprogramClientId`。
- 客户端永远不传 `tenantId`。
- Route、service、repository 三层都使用服务端租户上下文。
- activity、journey、profile、submission 必须属于同一租户。

### 11.3 用户与手机号

- 问卷档案关联 `(tenantId, userId)`。
- 手机号仍使用 SaaS 已定义的用户身份/渠道真源，不在档案重复保存。
- 同一全局用户加入多个租户时，每个租户拥有独立问卷档案。
- 用户合并或渠道合并必须限定租户业务关系，不能跨租户迁移业务数据。

### 11.4 权限与审计

- 先检查 `tenant_memberships` 有效状态。
- 再检查 `tenant_menu_permissions.analytics.canView/canEdit`。
- 活动级授权作为更细范围，与菜单权限取交集。
- 系统平台管理员也必须显式选择租户上下文后访问数据。
- 导出、授权和敏感访问写入 `tenant_audit_logs`，记录 `tenantId`。

### 11.5 数据迁移

从单租户迁移时：

1. 创建目标 tenant。
2. 建立旧用户到 `tenant_users` 的关联。
3. 通过活动 `legacyId` 映射 activity。
4. 导入 profile、journey、event，并注入目标 `tenantId`。
5. 校验每张表数量、孤儿外键和事件漏斗。
6. 双写观察期内比较单租户与 SaaS KPI。
7. 切换小程序 AppID 路由后停止单租户写入。

### 11.6 API 兼容

小程序问卷路径、请求和响应保持不变。租户差异完全由 AppID、JWT 和服务端上下文处理，不向小程序暴露 `tenantId`，从而降低迁移成本。

## 12. 完成定义

本功能只有在以下条件全部满足后才算完成：

- 小程序接口契约通过联调。
- 活动投稿无法绕过问卷门禁。
- 手机号绑定与账号合并没有产生重复用户或半完成档案。
- 三张 KPI 与两条路径可由数据库事实复算。
- 活动运营只能看到管理员授权的活动。
- 页面、导出、日志和错误中无敏感字段泄露。
- 小样本保护在服务端完成。
- 隐私保护指引与实际收集字段、用途、触发时机一致。
- 多租户方案只停留在计划，不影响当前单租户交付。
- Admin 信息架构与原型一致，视觉与交互组件通过现有 Design System 验收。

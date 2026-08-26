# Questionnaire Feature Documentation

本目录用于沉淀语料采集活动参赛前问卷及问卷洞察看板的产品输入、确认口径和研发实施方案。

## 文档索引

### 研发基线

以下文档反映已确认的业务决策，是单租户 V1 的研发与联调准则：

1. [业务规则](./questionnaire-business-rules.md)
2. [小程序接口文档](./questionnaire-miniprogram-api.md)
3. [实施计划](./implementation-plan.md)
4. [多租户迁移实施计划](./multi-tenant-migration-plan.md)
5. [已完成问卷用户无阻塞投稿升级说明](./2026-08-25-reused-submission-client-update.md)

### 原始产品输入

以下文档及 Demo 保留为产品背景、交互和视觉参考；若与研发基线冲突，以研发基线为准：

1. [活动小程序参赛问卷 PRD](./s6-miniprogram-participant-questionnaire/s6-miniprogram-participant-questionnaire.md)
2. [问卷数据洞察看板 PRD](./s6-questionnaire-insights-dashboard-v2/s6-questionnaire-insights-dashboard-v2.md)
3. [小程序交互 Demo](./s6-miniprogram-participant-questionnaire/image-attachments/miniprogram-questionnaire-demo-v3-ipad.html)
4. [后台看板 Demo](./s6-questionnaire-insights-dashboard-v2/image-attachments/questionnaire-insights-admin-interactive-v6.html)

## 已确认范围

- 业务与接口负责人：Fynn。
- 当前先在 `dimsum-app` 实现单租户方案。
- `corpus-collection-saas` 仅纳入多租户后续实施计划，本期不修改。
- 问卷第三题是用户“兴趣类型”，不是活动自身的活动标签。
- 兴趣类型为选填、多选。
- 手机号复用现有 `User.phoneNumber`，未绑定时必须短信验证。
- 首页仅展示三张 KPI：已完成参赛前登记、登记后投稿率、资料复用率。
- 首次登记与资料复用使用两条独立转化路径。
- 用户不能查看、修改或删除问卷答案。
- 问卷资料不自动过期；法定删除、账号删除和安全处置仍可覆盖业务保留规则。
- 问卷定义由数据库保存并按版本发布；后台发布新版本不会改变进行中的旅程或已保存档案。
- 当前版本不启用多租户。
- 活动运营的活动访问范围由管理员配置。

## 术语约束

- `activityTag`：活动后台配置的单个四字活动标签，例如“饮食文化”。保存在活动 `tags` 字段中。
- `interestTypes`：用户问卷中的选填、多选兴趣类型，例如“故事”“诗歌”。
- 两者是不同维度，不得共用 `activity_tags` 字段或统计口径。

# 词条身份信息与搜索分发能力文档

## 一、文档定位

本文档组用于承接“词条身份信息体系”新需求，覆盖 Search 前台、Admin 后台、分享卡片工具、SEO 落地页与后续投放支持。

本文档已经按现有 `dimsum-app/main` 与 `dimsum-app/deno` 源码校正：当前系统的业务主实体是 `cantonese_corpus_all`，公开身份 ID 是 `unique_id`，旧搜索接口来自 Deno backend 的 `/v2/text_search`，后台已有 `/admin/corpus` 与 `/admin/categories`。因此本需求应设计为“现有语料搜索系统增强”，不是另起一套孤立 Entry 服务。

本期架构建议：新搜索分层接口优先放在 Next Route Handler 中，由 Next 服务端直连 Supabase RPC；Deno 的 `/v2/text_search` 保留为历史兼容接口，不在本期继续扩展新业务能力。

目录结构：

| 文档 | 说明 |
|------|------|
| `source-audit.md` | 现有源码、模型、页面、接口和分享逻辑梳理 |
| `business-logic.md` | 产品目标、用户场景、搜索分层、分享与 SEO 业务逻辑 |
| `data-model.md` | 词条身份信息字段、分类标签模型、推荐数据表 |
| `admin-design.md` | Admin 后台菜单、页面、权限、审核与维护流程 |
| `api.md` | Search 前台、Admin 后台、分享卡片、SEO 页面接口草案 |
| `responsibilities.md` | @RAiN 与其他协作方职责拆分、剩余任务清单 |
| `rain-handoff.md` | 给 @RAiN 的具体对接说明和可直接发送的话术 |
| `search-ranking-recommendation.md` | 一级/二级/三级搜索相关性、推荐策略和 Supabase 实现建议 |

---

## 二、需求摘要

本期希望为每个语料词条建立统一的身份信息，使现有 `cantonese_corpus_all` 记录不仅能被搜索，也能被展示、推荐、分享、沉淀到 SEO 页面，并在后续支持投放与个性化推荐。

核心公式：

```text
搜索 = 分类（结构） + 向量（语义） + 标签（扩散）
分发 = SEO（站外） + 卡片（站内外传播）
数据底座 = 词条身份信息体系
```

---

## 三、源码对齐后的本期范围

| 模块 | 本期目标 |
|------|----------|
| 词条身份信息 | 基于 `cantonese_corpus_all` 聚合 `unique_id`、`data`、`note`、`structured_note`、`category`、`tags`、状态与分享信息 |
| Search 前台 | 在现有 `/search` 上增加一级精准结果、二级相似结果、三级推荐结果展示；由 Next `/api/search/entries` 提供分层响应 |
| 分类标签 | 本期落地一级/二级语义分类，增强现有 `cantonese_categories` 与 `tags` JSON，支持标签类型与相关度 |
| 分享卡片 | 复用 `card.app.aidimsum.com/?uuid=` 与站内 card-generator，补充预览、下载、复制链接、埋点 |
| SEO 支持 | 基于 `unique_id` 提供词条详情页，基于现有分类和标签生成聚合页 |
| Admin 后台 | 增强现有 `/admin/corpus`、`/admin/categories`，补充身份信息、标签治理和分享配置 |

---

## 四、暂不纳入本期

- 完整千人千面推荐策略。
- 站外 SEO 付费投流闭环。
- 广告账户和投放系统。
- 全自动无人工审核的数据治理机制。
- 复杂向量召回排序策略的最终权重配置。

---

## 五、初步产品判断

1. `entryIdentity` 应是基于现有语料记录的聚合对象，不是新的主表概念。
2. `entryId` 对外应直接使用现有 `unique_id`，避免破坏已存在的分享、互动、编辑链路。
3. 本期新搜索接口放在 Next Route Handler，直接使用 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY` 在服务端调用 Supabase RPC。
4. Deno backend 的 `/v2/text_search` 保持兼容，不承载本期新增的身份聚合、一级/二级分类、分享和 SEO 逻辑。
5. 一级精准结果需要优先保证稳定性和速度；二级/三级推荐可以允许异步增强或降级为空。
6. 标签建议先在现有 `tags` 能力上扩展结构化格式，相关度等级采用枚举值，向量召回作为后续增强能力接入。
7. 分享卡片与 SEO 页面应复用同一份 `entryIdentity` 数据，避免 Search、卡片、落地页字段口径不一致。
8. Admin 后台需要增强现有 Corpus Data 和 Categories 页面，而不是重复建设一套 Search Entries 后台。

---

## 六、关键待确认项

| 问题 | 当前建议 | 需要对齐对象 |
|------|----------|--------------|
| 一级/二级分类如何落库 | 本期落地，建议新增稳定字段承载语义分类，现有 `category` 继续表示语料库/dataset | 产品 / 运营 / 数据侧 |
| 标签相关度如何定义 | 先使用 `precise/related/recommended` + `strong/medium/weak`，后台可编辑 | 产品 / 运营 |
| 贡献者字段来源 | 现有贡献者可能在 `note.contributor` 或 `note.context.author`，需定义解析优先级 | 数据侧 |
| 一级搜索命中规则 | Next `/api/search/entries` 直连 Supabase RPC 后二次分组；后续可沉淀为数据库 RPC | 搜索侧 |
| 二级结果召回优先级 | 本期先标签召回，向量召回作为增强 | 搜索 / 算法 |
| 分享卡片可承载字段 | 现有卡片工具已支持 `uuid`，需与 AW 对齐是否增强原工具或新建模板 | AW |
| SEO 页面是否需要 SSR | 建议需要，至少词条页、分类页、标签页可被爬虫稳定访问 | 前端 / SEO |

---

## 七、建议里程碑

| 阶段 | 工作内容 |
|------|----------|
| P0 | 确认 `entryIdentity` 从现有字段的映射规则、一级/二级分类字段、标签结构 |
| P1 | 增强 `/admin/corpus` 和 `/admin/categories`，支持身份信息、一级/二级分类与标签治理 |
| P2 | 完成 `/search` 一级精准结果身份信息展示，兼容旧搜索响应 |
| P3 | 完成二级标签召回与三级推荐展示 |
| P4 | 增强现有卡片分享工具，支持预览弹窗、下载、复制链接、分享统计 |
| P5 | 补充 SEO 词条页、分类页、标签页与站外埋点统计 |

# 职责拆分

## 一、拆分原则

本需求横跨数据、搜索、后台、分享和 SEO。为了避免职责混在一起，建议按“数据底座”和“产品交付面”拆分。

@RAiN 侧重点应是词条身份信息的数据能力，确保 Search、Admin、分享卡片和 SEO 都能拿到稳定、可追溯、可维护的数据。

---

## 二、@RAiN 负责范围

### 2.1 词条身份信息数据底座

@RAiN 负责定义并落地词条身份信息字段，包括：

| 字段/能力 | 说明 |
|-----------|------|
| `unique_id` | 继续作为词条公开唯一 ID |
| `data` | 词条内容 |
| `identity_category_l1` | 词条身份一级分类，本期新增 |
| `identity_category_l2` | 词条身份二级分类，本期新增 |
| `structured_note.identity` | 读音、粤拼、释义、贡献者、封面等身份扩展信息 |
| `tags` 结构化 | 精准标签、关联标签、推荐标签、相关度、来源 |
| `lifecycle_stage` | 草稿、审核、上线、下线等状态 |

### 2.2 数据库与迁移

@RAiN 负责或主导：

- 确认 `cantonese_corpus_all` 是否新增字段：
  - `identity_category_l1`
  - `identity_category_l2`
- 确认是否新增身份分类字典表：
  - `corpus_identity_categories`
- 确认结构化标签继续存 `tags` JSON，还是拆为标签字典表和关系表。
- 提供 Prisma schema / SQL migration 方案。
- 保证旧数据兼容，不破坏现有 `category`、`tags`、`note` 使用。

### 2.3 身份信息解析规则

@RAiN 负责确定字段解析优先级：

```text
structured_note.identity 优先
  -> note.context / note.contributor 兼容
  -> 缺失则返回 null
```

需要输出：

- 读音字段从哪里取。
- 粤拼字段从哪里取。
- 释义字段从哪里取。
- 贡献者字段从哪里取。
- 封面图、音频、视频字段从哪里取。

### 2.4 搜索侧数据可用性

Supabase RPC、搜索排序、标签召回和推荐召回不归 @RAiN 主责，这部分由 Search / Next 后端负责。

@RAiN 只负责保证搜索侧能读取到稳定、口径明确的数据字段：

- `unique_id`
- `data`
- `note`
- `structured_note`
- `category`
- `identity_category_l1`
- `identity_category_l2`
- `tags`
- `lifecycle_stage`

如果 Next 后端需要新 RPC 或调整 `search_cantonese_corpus`，由 Search / Next 后端提出和实现；@RAiN 只配合确认字段含义和数据质量。

### 2.5 数据治理与初始化

@RAiN 负责或配合：

- 现有词条身份字段补齐策略。
- 旧字符串 `tags` 到结构化 tags 的迁移策略。
- 一级/二级分类的初始映射。
- 缺失字段识别规则。
- AI 初分类和人工复核的数据写入口径。

---

## 三、@RAiN 不负责或不主责范围

以下不建议归 @RAiN 主责，但需要 @RAiN 提供数据支持：

| 模块 | 主责建议 | @RAiN 配合点 |
|------|----------|--------------|
| Search 页面 UI | 前端 / Fynn | 提供字段和搜索结果结构 |
| Next `/api/search/entries` | Next 后端 / Fynn | 使用 @RAiN 提供的数据字段，负责 RPC/查询、排序和分层 |
| Admin 页面 | Admin 前端 / 后端 | 提供数据模型、字段校验规则 |
| 分享卡片 | AW | 提供 `entryIdentity` 字段 |
| SEO 页面 | 前端 / SEO | 提供可索引字段和分类/标签数据 |
| 埋点统计 | 前端 / 数据分析 | 提供 ID 口径 |

---

## 四、剩余任务清单

### 4.1 Next Search 接口

主责：Fynn / Next 后端

任务：

- 新增 `app/api/search/entries/route.ts`。
- 使用 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 服务端调用 Supabase RPC 或表查询。
- 如有必要，新建 `search_cantonese_corpus_v2`，旧 `search_cantonese_corpus` 不动。
- 实现繁简搜索。
- 合并去重。
- 按 dataset 过滤现有 `category`。
- 构造 `entryIdentity`。
- 返回 `primary`、`similar`、`recommended`。
- 失败时支持回退旧 Deno `/v2/text_search`。

### 4.2 Search 前台页面

主责：前端

任务：

- 改造 `/search` 消费 `/api/search/entries`。
- 一级结果展示完整身份卡。
- 二级结果展示相似词条。
- 三级结果展示推荐词条。
- 恢复并优化 Unique ID 展示与复制。
- 增加分享卡片入口。
- 兼容旧 `SearchResult[]`。

### 4.3 Admin 后台

主责：Admin 前端 / Next 后端

任务：

- 增强 `/admin/corpus`。
- 支持编辑身份信息。
- 支持编辑一级/二级分类。
- 支持结构化标签编辑。
- 支持缺失字段筛选。
- 支持身份完整度展示。
- 增强 `/admin/categories` 或新增身份分类管理。

### 4.4 分享卡片

主责：AW

任务：

- 确认卡片字段承载范围。
- 复用 `card.app.aidimsum.com/?uuid=`。
- 支持 Web 弹窗预览。
- 支持移动端底部预览层。
- 支持下载图片。
- 支持复制卡片链接和 SEO 链接。
- 接入分享事件统计。

### 4.5 SEO 页面

主责：前端 / SEO

任务：

- 新增 `/entries/{uniqueId}`。
- 新增分类聚合页。
- 新增标签聚合页。
- 输出 title、description、canonical。
- 页面使用 `entryIdentity`。
- 支持外部分享链接打开。

### 4.6 埋点与统计

主责：前端 / 数据分析

任务：

- `search_keyword`
- `result_entry_id`
- `result_position`
- `source_channel`
- `share_card_click`
- `share_link_open`
- `register_conversion`
- `page_view_path`

### 4.7 Deno backend

主责：暂不新增主任务

任务：

- 保留 `/v2/text_search`。
- 保留 `/v2/corpus_item`。
- 不在本期扩展新分层搜索。
- 作为 Next 新接口失败时的 fallback。

---

## 五、建议会议决策项

1. @RAiN 是否确认新增 `identity_category_l1` / `identity_category_l2`。
2. @RAiN 是否确认结构化标签先继续存 `tags` JSON。
3. Search / Next 后端是否新建 `search_cantonese_corpus_v2`，旧 RPC 是否完全不动。
4. Admin 是否需要首期支持批量导入和 AI 初分类。
5. AW 分享卡片首期字段上限是什么。
6. SEO 词条页是否本期必须上线，还是 P5。

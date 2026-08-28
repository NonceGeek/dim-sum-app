# 语料身份搜索方案

## 一、当前结论

本需求是在现有语料库 `cantonese_corpus_all` 上建设“语料身份 + 搜索分层 + 推荐分发”能力，不新建一套独立 Entry 主实体。

最终口径：

```text
语料主实体：cantonese_corpus_all
公开 ID：unique_id
后端数据底座：分类表、标签表、相关标签表、字段级向量表
前端交付面：Next Search API、Search UI、分享卡片、SEO 页面
```

本期搜索结果：

| Section | 数量 | 交互 |
|---------|------|------|
| `primary` | 1 条 | 精准最佳答案，不分页 |
| `similar` | 3 条 | 换一批 |
| `recommended` | 4 条 | 换一批 |

一级精准结果不走向量；二级和三级可把向量作为候选维度，但优先结合标签、相关标签和分类。

---

## 二、推荐阅读顺序

### 先看这三份

| 文档 | 用途 |
|------|------|
| `README.md` | 当前结论和文档地图 |
| `implementation-progress.md` | 当前实施状态、可开发项、暂缓项 |
| `semantic-search-optimization/README.md` | 2026-08-27 探索搜索优化专题索引 |
| `semantic-search-optimization/performance-analysis-and-current-optimization.md` | 线上慢查询证据、根因和当前优化 |
| `semantic-search-optimization/offline-neighbor-table-implementation-plan.md` | 离线邻居表、周期任务、灰度与回滚方案 |
| `frontend-backend-contract.md` | 前后端职责边界、接口契约、待实现清单 |
| `语料身份需求.md` | 后端确认的数据表、DDL、查询示例 |

### 后端 / 数据侧

| 文档 | 用途 |
|------|------|
| `语料身份需求.md` | 后端数据底座 Source of Truth |
| `data-model.md` | 面向产品和前端的 entryIdentity 数据模型 |
| `search-engine-research.md` | qwen3-vl-embedding、pgvector、短 query 策略 |
| `semantic-search-optimization/offline-neighbor-table-implementation-plan.md` | 完整三级向量扩散的数据实施方案 |

### 前端 / Next / UI

| 文档 | 用途 |
|------|------|
| `frontend-backend-contract.md` | 前后端怎么对接 |
| `api.md` | Next `/api/search/entries` 和 Admin API 草案 |
| `entry-detail-api.md` | 词条详情页数据来源、Supabase RPC 和服务端复用方式 |
| `search-results-ui.md` | Search 页面展示和换一批交互 |
| `tag-and-identity-model.md` | note、corpus_tags、tag_related 的标签口径和 UI 展示边界 |
| `search-ranking-recommendation.md` | primary / similar / recommended 召回与排序 |
| `admin-design.md` | Admin 后台如何治理分类、标签、身份字段 |

### 背景和历史

| 文档 | 用途 |
|------|------|
| `business-logic.md` | 产品目标、用户场景、分享和 SEO 逻辑 |
| `source-audit.md` | 现有源码、旧接口、旧页面梳理 |
| `archive/` | 早期 RAiN 对接和职责拆分过程稿，不再作为最新数据口径 |

---

## 三、后端负责什么

后端负责“数据底座”：

| 能力 | 表 / 来源 |
|------|-----------|
| 语料主数据 | `cantonese_corpus_all` |
| 结构化内容 | `structured_note.data[].blocks` |
| 两级身份分类 | `content_categories`、`corpus_category` |
| 标签词表 | `tags` |
| 语料标签关系 | `corpus_tags` |
| 相关标签 | `tag_related` |
| 字段级向量 | `corpus_field_embeddings` |
| active 离线邻居 | `corpus_embedding_neighbors` / `corpus_embedding_neighbor_builds` |
| 编辑贡献者 | `cantonese_corpus_update_history` |

后端需要保证：

- 语料只挂一个二级身份分类。
- 当前 `corpus_tags` 可提供语料标签关系。
- 本期先不依赖 `corpus_tags.tag_role` 和 `corpus_tags.relevance_level`；前端聚合时把已有标签统一视为 `related / medium`。
- `tag_related` 可按 `cooc / semantic / manual` 提供相关标签。
- `corpus_field_embeddings` 用于 query -> similar；similar -> recommended 不再执行未命中
  HNSW 的在线动态扩散，已改为读取 active `corpus_embedding_neighbors`。

---

## 四、前端负责什么

前端和 Next 负责“交付面”：

- 新增 `GET /api/search/entries`。
- 使用服务端 Supabase key 聚合数据。
- 输出统一 `entryIdentity`。
- 实现 `primary / similar / recommended` 三段结果。
- Search UI 展示一级大卡、二级 3 条、三级 4 条。
- 实现二级/三级“换一批”。
- 复用 `entryIdentity` 做分享卡片和 SEO 页面。

安全边界：

- `SUPABASE_SERVICE_ROLE_KEY` 只能在 Next Route Handler 使用。
- 浏览器不得直接访问 Supabase service role key。
- 旧 Deno `/v2/text_search` 保留兜底，不承载本期新能力。

---

## 五、核心数据口径

### 5.1 分类

不再新增：

```text
identity_category_l1
identity_category_l2
```

正式使用：

```text
content_categories
corpus_category
```

对外仍聚合为：

```json
{
  "category": {
    "primary": {},
    "secondary": {}
  }
}
```

### 5.2 标签

不再把新标签治理写入：

```text
cantonese_corpus_all.tags
```

正式使用：

```text
tags
corpus_tags
tag_related
```

对外聚合为：

```json
{
  "tags": {
    "precise": [],
    "related": [],
    "recommended": []
  }
}
```

当前 P0 兼容口径：

- `corpus_tags` 里已有的语料标签统一进入 `related`。
- `relevanceLevel` 统一按 `medium` 输出。
- `precise` 暂时由一级精准命中、标题命中或运营规则派生；没有规则时可为空。
- `recommended` 优先由 `tag_related` 扩展，不要求语料本身已有 recommended tag。

### 5.3 向量

字段级向量表：

```text
corpus_field_embeddings
```

使用原则：

- 一级精准不走向量。
- 二级和三级可用向量增强。
- 短 query 优先标签、相关标签和分类。
- 长 query 或完整句子再提高向量权重。

---

## 六、当前待办

### 暂缓字段

以下字段属于后续增强项，当前实施先不阻塞：

| 表 | 字段 | 暂缓原因 |
|----|------|----------|
| `corpus_tags` | `tag_role` | 当前已有标签可先统一按 `related` 展示 |
| `corpus_tags` | `relevance_level` | 当前可统一按 `medium` 输出 |
| `corpus_category` | `confidence` | 主要用于 AI 分类复核，不影响前台展示 |
| `corpus_category` | `batch_id` | 主要用于批量导入追溯，不影响前台展示 |

### 后端待确认

- 是否能提供批量聚合 `entryIdentity` 的 SQL / RPC。
- 按 `semantic-search-optimization/offline-neighbor-table-implementation-plan.md`
  建设离线邻居表与构建任务。

### 前端待实现

- `/api/search/entries`
- `entryIdentity` 聚合器
- Search 页面三段式结果
- 二级和三级换一批
- 分享卡片预览
- SEO 词条页、分类页、标签页

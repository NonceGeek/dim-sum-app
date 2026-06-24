# 实施进度

更新时间：2026-06-24

本文用于记录“语料身份搜索”从方案进入实施后的状态。`语料身份需求.md` 是后端原始数据底座文档，不写入前端实现建议、搜索策略建议或暂缓字段建议；这些内容统一沉淀在本文、`data-model.md`、`search-ranking-recommendation.md` 和 `frontend-backend-contract.md`。

---

## 一、当前结论

可以开始前端 / Next P0 实施。

后端当前已经提供本期开发所需的核心表：

| 能力 | 表 | 当前判断 |
|------|----|----------|
| 语料主数据 | `cantonese_corpus_all` | 可用 |
| 两级分类树 | `content_categories` | 可用 |
| 语料分类关系 | `corpus_category` | 可用 |
| 标签词表 | `tags` | 可用 |
| 语料标签关系 | `corpus_tags` | 可用 |
| 相关标签 | `tag_related` | 可用 |
| 字段级向量 | `corpus_field_embeddings` | 可用，P0 不强依赖 |
| 编辑贡献者 | `cantonese_corpus_update_history` | 可用 |

P0 不等待 `tag_role`、`relevance_level`、`confidence`、`batch_id` 这些增强字段。

---

## 二、已确认数据状态

已通过数据库模型和实际表结构确认：

| 表 | 数据状态 |
|----|----------|
| `cantonese_corpus_all` | 约 3 万条语料 |
| `corpus_category` | 已覆盖绝大部分语料 |
| `tags` | 已有清洗后的标签词表 |
| `corpus_tags` | 已有语料标签关系 |
| `tag_related` | 已有共现和语义相关标签数据，manual 口子预留 |
| `corpus_field_embeddings` | 已有 text 类字段向量，主要包括 `doc`、`definition`、`sentence`、`headword` |

当前向量表可作为二级/三级推荐增强，但一级精准结果仍走文本匹配。

---

## 三、暂缓字段

以下字段是后续增强项，先写入文档但不阻塞开发：

| 表 | 字段 | 后续用途 | 当前 P0 处理 |
|----|------|----------|--------------|
| `corpus_tags` | `tag_role` | 区分 precise / related / recommended | 所有已有标签统一按 `related` 输出 |
| `corpus_tags` | `relevance_level` | 区分 strong / medium / weak | 统一按 `medium` 输出 |
| `corpus_category` | `confidence` | AI 分类置信度复核 | 不展示、不参与排序 |
| `corpus_category` | `batch_id` | AI 分类批次追溯和回滚 | 不展示、不参与排序 |

如果后续要加字段，建议迁移 SQL：

```sql
alter table corpus_tags
add column tag_role text not null default 'related'
  check (tag_role in ('precise', 'related', 'recommended')),
add column relevance_level text not null default 'medium'
  check (relevance_level in ('strong', 'medium', 'weak'));

alter table corpus_category
add column confidence real,
add column batch_id text;
```

---

## 四、P0 实施范围

### 4.1 Next API

新增：

```text
GET /api/search/entries
```

职责：

- 接收 `q`、`scope`、`similarCursor`、`recommendedCursor` 等查询参数。
- 在服务端连接 Supabase / Postgres。
- 生成 `primary / similar / recommended` 三段结果。
- 聚合每条语料的 `entryIdentity`。
- 对浏览器隐藏 Supabase service role key 和向量服务 key。

### 4.2 entryIdentity 聚合

P0 聚合字段：

| 字段 | 来源 |
|------|------|
| `entryId` | `cantonese_corpus_all.unique_id` |
| `entryName` | `cantonese_corpus_all.data` |
| `jyutping` | `structured_note.data[].jyutping` |
| `meaning` | `structured_note.data[].blocks[type=definition]` |
| `source` | `cantonese_corpus_all.category` + category nickname |
| `category.primary` | `content_categories` 一级 |
| `category.secondary` | `content_categories` 二级 |
| `tags.related` | `corpus_tags` + `tags` |
| `tags.recommended` | `tag_related` + `tags` |
| `contributor` | `cantonese_corpus_update_history.contributor_user_id` |
| `assets` | `structured_note.data[].blocks` |
| `stats` | `liked_num` / `bookmark_num` / `view_num` |
| `share` | 按 `unique_id` 生成 |

### 4.3 搜索分层

| Section | 数量 | P0 逻辑 |
|---------|------|---------|
| `primary` | 1 | exact / 繁简 exact / prefix / like / full text，取最佳 |
| `similar` | 3 | 以后端文档为准，优先用用户 query 调阿里云生成 1024 维向量，再查 `corpus_field_embeddings(field_type='doc')`；融合/兜底同标签和同二级身份分类 |
| `recommended` | 4 | 基于 query vector、`tag_related`、同二级身份分类、同一级身份分类热门融合排序 |

二级和三级不做传统分页，只提供“换一批”刷新。

---

## 五、实施清单

### 文档

- [x] 梳理文档目录和阅读顺序。
- [x] 区分后端数据底座和前端交付面。
- [x] 明确 `primary=1`、`similar=3`、`recommended=4`。
- [x] 明确 `tag_role`、`relevance_level`、`confidence`、`batch_id` 暂缓。
- [x] 新增实施进度文档。

### 前端 / Next

- [x] 梳理现有 Search 页面和 API 调用点。
- [x] 新增 Search API 类型定义。
- [x] 新增 `entryIdentity` 聚合器。
- [x] 新增 `/api/search/entries` Route Handler。
- [x] 实现 primary 召回和排序。
- [x] 实现 similar 召回和“换一批”。
- [x] 实现 recommended 召回和“换一批”。
- [x] 本地验证 `/api/search/entries?q=好` 可返回 `primary=1`、`similar=3`、`recommended=4`。
- [x] 新增 `useEntrySearchQuery`，与旧 `useSearchQuery` 并行存在。
- [x] 新增三段式结果展示组件 `EntrySearchSections`。
- [x] 以 `/search?mode=entry&q=...` 方式接入 Search 页面 UI，不影响旧列表模式。
- [x] 接入分享卡片预览弹窗，支持复制链接和打开卡片。
- [x] 前端拆分 primary / semantic 两个请求，支持分别 loading。

### 后端 / 数据配合

- [x] 核心表已存在。
- [x] 分类和标签已有初始化数据。
- [x] 字段级向量表已存在。
- [x] 优化聚合查询性能：已将多次 `$queryRaw` 合并为单次聚合 SQL，热请求约 1.1-1.3 秒。
- [x] 三级推荐兜底已从旧 `cantonese_corpus_all.category` 调整为 `corpus_category -> content_categories` 身份分类。
- [x] 二级相似结果已按后端文档接入 `corpus_field_embeddings` 的 doc 向量 KNN 召回；三级推荐低权重融合 doc 向量候选。
- [x] 新增 query embedding 接入点：`DASHSCOPE_API_KEY` / `ALIBABA_CLOUD_DASHSCOPE_API_KEY` 配置后，semantic section 会先调阿里云 `qwen3-vl-embedding` 获取用户 query 向量。
- [ ] 确认是否需要提供批量 `entryIdentity` RPC。

---

## 六、与后端原始文档的实现差异

`语料身份需求.md` 只保留后端原始数据底座描述。当前前端 / Next 实现与该文档的关系如下：

| 项目 | 当前实现 | 后续处理 |
|------|----------|----------|
| `structured_note.data[].jyutping` | 已读取 | 多音字目前取第一条有值读音，后续可按 UI 展开多读音 |
| `blocks[type=image/video/audio].url` | 已读取 | 视频封面不落库，后续如需展示优先走 OSS 截帧 |
| `content_categories` / `corpus_category` | 已用于身份分类展示、相似和推荐兜底 | 后续 Admin 再做人工治理 |
| `tags` / `corpus_tags` | 已作为已有标签输出到 `related` | 后续如后端新增 `tag_role` / `relevance_level`，再拆分 precise / related / recommended |
| `tag_related` | 已用于推荐语料和推荐标签，推荐标签过滤 `corpus_count >= 3` | 后续可接 manual 权重治理 |
| `corpus_field_embeddings` | semantic section 优先使用用户 query vector 查询 doc 向量；缺少 DashScope key 时 fallback 到 primary doc 向量/规则版 | 后续可扩展到 `sentence` / `definition` / `headword` 分面 |
| 一级精准搜索 | 当前为 exact / lower exact / prefix / like | full text 和繁简归一后续接 |

---

## 七、下一步

当前已完成非向量版服务端 API 第一版：

```text
main/lib/search/entry-identity.ts
main/app/api/search/entries/route.ts
main/lib/api/search.ts
main/app/[locale]/(home)/_components/entry-search-sections.tsx
main/app/[locale]/(home)/search/page.tsx
```

下一步先做三件事：

1. 用浏览器检查 `/search?mode=entry&q=好` 的桌面和移动端视觉布局。
2. 验证分享卡片弹窗、复制链接、打开卡片、新旧搜索并行时的 loading、空结果、换一批状态。
3. 如线上仍需更低延迟，再把聚合 SQL 下沉为 Supabase RPC，并评估缓存热门 query。

向量检索当前按后端方案改为 query→doc 查询优先；`primary` 文本搜索和 `semantic` 向量搜索在前端分别请求、分别 loading。后续 P0.5 再把 `sentence` / `definition` / `headword` 分面接入，并评估查询耗时和索引命中。

当前性能观察：

- `primary` 单 SQL 约 100ms。
- 原始 `similar` SQL 曾因 `left join + or + group by` 扫描大量候选，约 2.38 秒；已改为从 `corpus_tags` / `corpus_category` 先取候选再合并分数，单 SQL 约 133ms。
- 多次远端 `$queryRaw` 每次有约 0.8-1.1 秒往返/执行成本，串行会把接口拖到 5 秒级。
- 已将 Route Handler 改成单次聚合 SQL，一次返回 primary / similar / recommended 候选和身份聚合数据。
- 非向量版本地热请求曾验证：普通搜索约 1.1-1.3 秒，换一批约 1.2-1.3 秒。
- 接入 `corpus_field_embeddings` doc 向量召回后，曾尝试“两步查：先取源向量、再绑定参数 KNN”，可命中 HNSW，但因为远端 DB 往返增加，接口退化到约 3.6-4.8 秒。
- 当前采用“单次聚合 SQL + 标量子查询取源向量”的写法，`EXPLAIN ANALYZE` 已确认向量段命中 `corpus_field_emb_doc_hnsw`；本地热请求约 1.9-2.4 秒，`好` 这类短 query 仍受 primary `%like%` 扫描和远端 DB 往返影响。
- 页面编译验证：`/zh-CN/search?mode=entry&q=好` 会 307 到默认 locale 无前缀路径，跟随重定向后返回 200。

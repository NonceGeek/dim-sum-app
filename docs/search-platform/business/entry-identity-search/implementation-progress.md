# 实施进度

更新时间：2026-06-23

本文用于记录“语料身份搜索”从方案进入实施后的状态。需求源头和数据口径仍以 `README.md`、`frontend-backend-contract.md`、`语料身份需求.md` 为准；本文只记录当前能做什么、做到哪里、哪些事项暂缓。

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
| `similar` | 3 | 先用同标签、相关标签、同分类召回；向量作为可选增强 |
| `recommended` | 4 | 先用 `tag_related`、同一级分类热门、dataset 热门兜底 |

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
- [ ] 接入 Search 页面 UI。
- [ ] 接入分享卡片预览。

### 后端 / 数据配合

- [x] 核心表已存在。
- [x] 分类和标签已有初始化数据。
- [x] 字段级向量表已存在。
- [ ] 优化推荐 SQL 性能：当前本地接口可跑通，但完整聚合耗时约 5 秒，不能直接视为上线性能。
- [ ] 确认是否需要提供批量 `entryIdentity` RPC。

---

## 六、下一步

当前已完成非向量版服务端 API 第一版：

```text
main/lib/search/entry-identity.ts
main/app/api/search/entries/route.ts
```

下一步先做三件事：

1. 拆分并 EXPLAIN 当前 `/api/search/entries` 的 primary / similar / recommended SQL，优先优化 5 秒级耗时。
2. 新增前端 hook，和旧 `useSearchQuery` 并行存在。
3. 接入 Search 页面三段式 UI。

向量检索放在 P0.5：等非向量链路跑通后，再把 `corpus_field_embeddings` 作为候选增强接入。

# 三级搜索相关性与推荐策略

## 一、设计目标

搜索结果分为三层：

| 层级 | 名称 | 目标 |
|------|------|------|
| 一级 | 精准结果 `primary` | 用户搜什么，最上方看到 1 个最佳词条 |
| 二级 | 相似结果 `similar` | 围绕当前词条继续发现相近内容 |
| 三级 | 扩展推荐 `recommended` | 展示更宽泛、可探索、可运营的相关内容 |

本期建议采用“确定性规则 + 可解释排序”，暂不直接上复杂个性化推荐。

---

## 二、一级精准结果

### 2.1 召回规则

优先召回：

```text
data = keyword
繁简转换后 data = keyword
data 前缀匹配
全文搜索命中
```

### 2.2 排序规则

建议排序：

```text
完全匹配
> 繁简完全匹配
> 前缀匹配
> 全文搜索 rank
> 浏览/收藏/点赞轻微加权
```

### 2.3 输出要求

一级结果只返回 1 个最佳命中，并且必须携带完整 `entryIdentity`：

- `unique_id`
- `data`
- 粤拼
- 释义
- 现有语料库 `category`
- `content_categories` 聚合出的一级/二级身份分类
- `corpus_tags` 聚合出的已有标签；P0 统一输出到 `related`
- `tag_related` 扩展出的 `recommended` 标签
- 分享链接

---

## 三、二级相似结果

### 3.1 召回目标

二级结果回答的问题是：

```text
这个词条附近还有什么？
```

### 3.2 召回规则

优先级：

```text
corpus_field_embeddings doc 向量相似
> 同 corpus_tags 已有标签
> 同二级身份分类
> 同一级身份分类
> 同现有 category/dataset
```

### 3.3 排序建议

```text
标签类型权重
+ 标签相关度权重
+ 分类相同权重
+ 全文搜索 rank
+ 浏览/收藏/点赞轻微加权
```

权重示例：

| 因子 | 建议权重 |
|------|----------|
| `field_type = doc` 向量相似 | +90 * similarity |
| 同已有标签 | +60 |
| `tag_related.method = manual` | +80 |
| `tag_related.method = cooc` | +45 |
| `tag_related.method = semantic` | +30 |
| 同二级身份分类 | +40 |
| 同一级身份分类 | +20 |
| 其他 field vector 相似 | 后续按 `sentence` / `definition` / `headword` 分面增强 |

二级结果应排除一级结果中已经展示的词条。

`corpus_tags.tag_role` 和 `corpus_tags.relevance_level` 暂缓落库期间，所有已有标签统一按 `related / medium` 处理；相关性差异主要由 doc 向量相似、标签命中数量、分类相同和文本命中共同决定。若源语料没有 doc 向量，二级结果回退到标签和分类规则。

---

## 四、三级扩展推荐

### 4.1 召回目标

三级结果回答的问题是：

```text
用户可能还想探索什么？
```

### 4.2 召回规则

优先级：

```text
tag_related 相关标签
> corpus_field_embeddings doc 向量弱召回
> 同一级分类下热门词
> 同 dataset 下热门词
> 运营配置 recommend_words
```

### 4.3 排序建议

三级结果可以更偏运营和热度：

```text
推荐标签相关度
+ 相关标签分数
+ 浏览量
+ 收藏量
+ 新鲜度
+ 运营置顶
```

三级结果不应影响一级精准结果排序。

---

## 五、Supabase / Postgres 实现建议

### 5.1 P0：规则 + RPC

本期推荐：

```text
Next /api/search/entries
  -> 调 Supabase RPC search_cantonese_corpus
  -> 合并繁简结果
  -> 根据 corpus_tags / tag_related / content_categories 分层
  -> 返回 primary / similar / recommended
```

优点：

- 上线快。
- 可解释。
- 不需要马上引入向量检索。
- 方便 Admin 和运营验证标签、分类质量。

### 5.2 P1：Postgres 全文检索优化

后续可在数据库层优化：

- 使用 `tsvector` / `tsquery` 做关键词搜索。
- 使用 `ts_rank` 或 `ts_rank_cd` 排序。
- 高频搜索字段建 GIN 索引。
- 对 `data`、`meaning`、`tags`、分类字段设置不同权重。

适合：

- 提升关键词搜索性能。
- 改善一级结果排序。
- 减少应用层排序复杂度。

### 5.3 P2：Hybrid Search

后续做语义相似时，采用：

```text
全文搜索 + pgvector 向量搜索
```

全文搜索负责：

- 字面命中。
- 精准结果。
- 可解释排序。

向量搜索负责：

- 语义相似。
- 同义词、近义表达。
- 内容相近但字面不重合的召回。

建议 embedding 输入：

```text
data
meaning
content_categories.name
tags.name / tags.gloss
```

### 5.4 P3：向量推荐

后端已经提供 `corpus_field_embeddings` 字段级向量表：

```text
field_type = doc / sentence / definition / headword / image / video
```

用于：

- 二级相似结果增强。
- 无标签词条召回。
- 后续个性化推荐。

使用策略：

- 一级精准结果不走向量，仍走 `cantonese_corpus_all.data` 的 exact / prefix / like / full text。
- 二级和三级可以把 `corpus_field_embeddings` 作为一个召回维度，但不作为唯一依据。
- query 是完整句子或较长表达时，可以尝试 `sentence` / `definition` / `doc` 向量。
- query 只有一两个字时，向量容易漂，优先同标签、相关标签、同分类，向量只做弱补充或不用。

---

## 六、本期不建议做的事

- 不建议一开始就做千人千面。
- 不建议一开始就强依赖向量搜索。
- 不建议把推荐完全黑盒化。
- 不建议让三级推荐影响一级精准结果。
- 不建议只靠浏览量排序，容易把热门内容推得过重。

---

## 七、参考文档

- Supabase Full Text Search: https://supabase.com/docs/guides/database/full-text-search
- Supabase Semantic Search: https://supabase.com/docs/guides/ai/semantic-search
- Supabase Hybrid Search: https://supabase.com/docs/guides/ai/hybrid-search
- Supabase Vector Columns / pgvector: https://supabase.com/docs/guides/ai/vector-columns
- PostgreSQL `ts_rank`: https://www.postgresql.org/docs/current/textsearch-controls.html

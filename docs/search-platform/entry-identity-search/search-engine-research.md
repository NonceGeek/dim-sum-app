# 搜索引擎方案调研

## 一、调研结论

本需求可以把搜索引擎拆成两层能力：

```text
精准搜索层：关键词、繁简转换、全文检索、分类和标签规则
语义召回层：qwen3-vl-embedding + Supabase pgvector
```

短期不建议直接用向量搜索替代现有关键词搜索。原因是词条搜索里“字面命中”非常重要，用户搜一个粤语词、短语、读音或精确文本时，一级结果必须稳定命中。向量搜索更适合二级相似结果和三级扩展推荐，用来补齐“字面不一样但语义接近”的内容。

本期推荐路径：

```text
P0：Next Route Handler + Supabase RPC / SQL + 规则排序
P1：接入 qwen3-vl-embedding，先服务二级/三级结果
P2：沉淀 Hybrid Search，把全文检索和向量检索合并排序
```

---

## 二、为什么可以由 Next 直接接

RAiN 提到的方案是：

```text
现有语料文本和图片批量跑 qwen3-vl-embedding
  -> 得到向量
  -> 存到 Supabase pgvector
查询时用搜索词调用 qwen3-vl-embedding
  -> 得到 query embedding
  -> SQL 查询 cantonese_corpus_all
```

这个方向成立，而且可以由 Next 后端直接接，不需要再通过 RAiN 中转。

原因：

| 维度 | 判断 |
|------|------|
| 性能 | Next Route Handler 少一层中转，请求路径更短 |
| 成本 | 避免 Next -> RAiN 服务 -> 阿里云 -> Supabase 的额外调用成本 |
| 交付速度 | Search UI、SEO、分享卡片都在 Next 项目内，聚合逻辑更容易统一 |
| 安全 | 阿里云 API Key、Supabase service role key 都只放在 Next 服务端 |
| 维护 | 向量查询、分层结果、UI 字段聚合由同一个 Search backend 管理 |

RAiN 更适合主责数据定义和数据治理：

- 哪些字段进入 embedding。
- 文本、图片、标签、分类如何清洗。
- 旧数据如何批量补向量。
- 向量缺失、脏数据、过期数据如何识别。

---

## 三、推荐架构

### 3.1 查询链路

```text
用户输入 q
  -> Next /api/search/entries
  -> 繁简转换与 query normalize
  -> 精准搜索：Supabase RPC / SQL / 全文检索
  -> 语义搜索：调用 qwen3-vl-embedding 得到 query vector
  -> Supabase pgvector 查相似词条
  -> 合并 exact / fulltext / tag / vector 结果
  -> 输出 primary / similar / recommended
```

### 3.2 离线向量生成链路

```text
cantonese_corpus_all
  -> 读取 data / meaning / category / content_categories / tags / corpus_tags / 图片 URL
  -> 拼接 embedding 输入文本
  -> 调用 qwen3-vl-embedding
  -> 写入 pgvector
  -> 记录 model / dimension / content_hash / embedded_at
```

离线批处理可以先做脚本或定时任务，不要求进入在线请求链路。

---

## 四、数据模型方案

### 4.1 快速方案：直接加列

如果本期只做文本向量，可以在 `cantonese_corpus_all` 增加：

```sql
ALTER TABLE cantonese_corpus_all
ADD COLUMN text_embedding vector(1024),
ADD COLUMN embedding_model text,
ADD COLUMN embedding_updated_at timestamptz;
```

优点：

- 改动小。
- 查询简单。
- 可以最快验证向量召回效果。

缺点：

- 不适合一个词条多张图片、多种向量。
- 后续模型升级或多模态融合时会变得拥挤。

### 4.2 推荐方案：独立 embeddings 表

长期更建议新增独立表：

```text
corpus_embeddings
```

字段建议：

| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `corpus_unique_id` | 关联 `cantonese_corpus_all.unique_id` |
| `modality` | `text` / `image` / `fused` |
| `source_field` | `entry_identity` / `image_url` / `structured_note` |
| `source_url` | 图片或视频封面 URL，可为空 |
| `content_hash` | 输入内容 hash，用于判断是否需要重跑 |
| `embedding` | pgvector 向量 |
| `embedding_model` | 例如 `qwen3-vl-embedding` |
| `embedding_dimension` | 向量维度 |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |

优点：

- 支持一个词条多条向量。
- 支持文本、图片、融合向量共存。
- 模型升级时可以并行保留旧向量和新向量。
- 更利于排查召回效果。

本期如果需要速度，可以先采用直接加列；如果确认图片向量也要进入搜索，建议直接建独立表。

---

## 五、Embedding 输入建议

### 5.1 文本向量输入

建议拼接成稳定模板，而不是只传 `data`：

```text
词条：{data}
释义：{meaning}
粤拼：{jyutping}
语料来源：{category_display_name}
一级分类：{content_categories.level1.name}
二级分类：{content_categories.level2.name}
精准标签：{precise_tags}
关联标签：{related_tags}
推荐标签：{recommended_tags}
```

这样可以让向量同时理解词条内容、释义、分类和标签。

### 5.2 图片向量输入

如果语料里有图片，图片向量建议单独存：

```text
modality = image
source_url = 图片 URL
```

查询文本可以和图片向量做跨模态相似召回，但本期 UI 不应过度依赖图片向量。图片更适合：

- 推荐相似卡片。
- SEO 页面相似内容。
- 运营找同主题素材。

---

## 六、排序与分层策略

### 6.1 一级精准结果

一级结果不建议由向量主导。

排序优先级：

```text
完全匹配
> 繁简完全匹配
> 前缀匹配
> 全文检索 rank
> 标签/分类轻微加权
> 向量分数轻微加权
```

向量只能作为同分情况下的补充分数，不能把字面不命中的内容顶到一级第一。

### 6.2 二级相似结果

二级结果适合引入向量。

排序优先级：

```text
同 precise tag
> 同 related tag
> tag_related 相关标签
> 同二级身份分类
> 向量相似度
> 同一级身份分类
> 热度轻微加权
```

二级结果需要排除一级已展示词条。

### 6.3 三级扩展推荐

三级结果可以更偏发现和运营。

排序优先级：

```text
recommended tags
> 向量相似度
> 同一级分类热门词
> 同语料库热门词
> 运营配置 recommend_words
```

三级结果允许弱相关，但需要展示为“推荐探索”，不能让用户误以为它是精准搜索结果。

---

## 七、Supabase 实现建议

### 7.1 pgvector

Supabase 支持 Postgres `pgvector`，可用于存储 embedding 并进行相似度检索。

查询示例：

```sql
SELECT
  c.unique_id,
  c.data,
  c.category,
  1 - (e.embedding <=> :query_embedding) AS vector_score
FROM corpus_embeddings e
JOIN cantonese_corpus_all c
  ON c.unique_id = e.corpus_unique_id
WHERE e.modality = 'text'
ORDER BY e.embedding <=> :query_embedding
LIMIT 50;
```

### 7.2 索引

向量数据量上来后，需要建索引。

建议：

- 低数据量验证阶段：可以先不建索引，直接测召回质量。
- 正式上线：优先考虑 HNSW。
- 如果数据非常大、写入批量稳定，也可以评估 IVFFlat。

索引示例：

```sql
CREATE INDEX corpus_embeddings_text_hnsw_idx
ON corpus_embeddings
USING hnsw (embedding vector_cosine_ops)
WHERE modality = 'text';
```

### 7.3 维度选择

需要和 qwen3-vl-embedding 的实际输出维度对齐。为了控制 Supabase 存储、索引和查询成本，建议优先评估 1024 维。如果模型默认维度更高，需确认是否支持自定义输出维度或降维策略。

---

## 八、在线接口设计建议

### 8.1 Next 环境变量

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ALIBABA_CLOUD_DASHSCOPE_API_KEY=
```

这些变量只能在服务端读取，不允许暴露给浏览器。

### 8.2 Route Handler 位置

```text
app/api/search/entries/route.ts
```

该接口负责：

- 调 Supabase 精准搜索。
- 调阿里云 embedding。
- 调 Supabase pgvector 搜索。
- 合并排序并输出分层结果。

向量使用原则：

- 一级精准结果不走向量，优先 exact / prefix / like / full text。
- 二级和三级可以使用 `corpus_field_embeddings`，但只是召回维度之一。
- 查询词较长或是完整句子时，向量可使用 `sentence` / `definition` / `doc`。
- 查询词只有一两个字时，向量结果容易漂，优先同标签、`tag_related`、同分类。

### 8.3 降级策略

如果阿里云 embedding 调用失败：

```text
primary 继续返回关键词搜索结果
similar 使用 tags / category 规则
recommended 使用 recommend_words / 热门词
vectorStatus = unavailable
```

不要因为向量服务失败导致搜索页整体不可用。

---

## 九、与 RAiN 的职责边界

建议这样和 RAiN 对齐：

```text
搜索接口、qwen3-vl-embedding 在线调用、pgvector 查询和 UI 分层结果，由 Search/Next 侧实现。

RAiN 侧主要帮忙确认：
1. cantonese_corpus_all 哪些字段进入 embedding。
2. 文本、图片、标签、分类的清洗规则。
3. 旧数据批量跑 embedding 的数据范围。
4. embedding 结果是否直接写 cantonese_corpus_all，还是写独立 corpus_embeddings 表。
5. 模型维度、模型版本、重跑策略和缺失字段识别规则。
```

---

## 十、阶段计划

| 阶段 | 目标 |
|------|------|
| P0 | 保持现有 RPC / SQL 关键词搜索，完成一级/二级/三级 UI 和规则分层 |
| P1 | 建 embedding 数据模型，跑一批文本向量，验证相似结果质量 |
| P2 | Next 搜索接口接入在线 query embedding，二级结果引入向量召回 |
| P3 | 图片向量入库，扩展跨模态推荐 |
| P4 | 形成 Hybrid Search 排序权重，并在 Admin 中展示召回原因 |

---

## 十一、参考资料

- [阿里云 Model Studio Embedding 文档](https://help.aliyun.com/zh/model-studio/embedding)
- [阿里云多模态 Embedding API 文档](https://help.aliyun.com/zh/model-studio/multimodal-embedding-api-reference)
- [Supabase Vector indexes](https://supabase.com/docs/guides/ai/vector-indexes)
- [Supabase HNSW indexes](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes)
- [Supabase Hybrid Search](https://supabase.com/docs/guides/ai/hybrid-search)

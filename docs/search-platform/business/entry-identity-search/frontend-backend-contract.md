# 前后端对接边界

## 一、结论

本需求分成两层：

```text
后端 / 数据侧：提供可查询、可治理、可推荐的数据底座
前端 / Next 侧：聚合数据、实现搜索接口、渲染 Search/UI/分享/SEO
```

后端不需要直接实现 Search 页面 UI，也不需要关心一级、二级、三级结果的视觉布局。前端也不直接维护底层分类、标签、向量数据，只消费后端表结构和聚合查询结果。

---

## 二、后端负责

### 2.1 数据表和数据治理

后端负责落地和维护以下表：

| 能力 | 表 |
|------|----|
| 语料主表 | `cantonese_corpus_all` |
| 结构化内容 | `cantonese_corpus_all.structured_note` |
| 身份分类 | `content_categories`、`corpus_category` |
| 标签词表 | `tags` |
| 语料标签关系 | `corpus_tags` |
| 相关标签 | `tag_related` |
| 字段级向量 | `corpus_field_embeddings` |
| 编辑贡献者 | `cantonese_corpus_update_history` |

### 2.2 分类

后端负责：

- 维护 `content_categories` 两级分类树。
- 维护 `corpus_category`，一条语料最多挂一个二级分类。
- 支持 AI 初始化分类。
- 支持人工复核后更新分类。
- 当前 P0 前端只依赖 `category_id` 和两级分类树。
- `confidence`、`batch_id` 先暂缓，后续用于 AI 分类复核、批量追溯和回滚。

前端只需要拿聚合后的一级/二级分类对象，不直接处理 parent_id 关系。

### 2.3 标签

后端负责：

- 从旧 `cantonese_corpus_all.tags` 清洗导入 `tags` / `corpus_tags`。
- 维护 `corpus_tags` 的语料标签关系。
- `tag_role`、`relevance_level` 先暂缓；P0 前端把已有 `corpus_tags` 统一聚合为 `related / medium`。
- 维护 `tags.gloss` 和 `tags.embedding`。
- 维护 `tag_related`，存放 `cooc` / `semantic` / `manual` 三类相关信号。

前端展示标签时只关心聚合后的：

```json
{
  "precise": [],
  "related": [],
  "recommended": []
}
```

### 2.4 structured_note

后端负责保证 `structured_note` 结构稳定：

```json
{
  "data": [
    {
      "jyutping": "wai4",
      "blocks": [
        { "type": "definition", "content": "解释" },
        { "type": "sentence", "content": "例句" },
        { "type": "audio", "url": "...", "duration": 2 },
        { "type": "image", "url": "..." },
        { "type": "video", "url": "..." }
      ]
    }
  ]
}
```

本期 `image` / `video` 暂不扩展封面、尺寸、mimeType。视频封面如后续需要，优先使用阿里云 OSS 视频单帧截取能力。

### 2.5 向量

后端负责维护 `corpus_field_embeddings`：

```text
field_type = doc / sentence / definition / headword / image / video
```

后端提供可用的向量查询能力。搜索实现以后端原始文档为准：一级精准结果不依赖向量；二级相似结果必须使用用户搜索文本的百炼 query vector 查询 `corpus_field_embeddings`；三级推荐从二级结果继续扩散，可叠加标签、分类和热度约束，避免只靠语义相似导致结果漂移。

---

## 三、前端 / Next 负责

### 3.1 Search 聚合接口

前端 Next 侧负责新增：

```text
GET /api/search/entries
```

该接口由 Next Route Handler 在服务端调用 Supabase，聚合后返回：

```text
primary       1 个最佳精准结果
similar       3 个相似结果
recommended   4 个推荐结果
```

浏览器只调用 Next API，不直接访问 Supabase service role key。

### 3.2 entryIdentity 聚合

Next 负责把底层表聚合成统一的 `entryIdentity`：

```text
cantonese_corpus_all
structured_note
cantonese_categories
content_categories / corpus_category
tags / corpus_tags / tag_related
cantonese_corpus_update_history
互动统计
分享链接
```

Search 页面、分享卡片、SEO 页面都消费同一个 `entryIdentity`，避免字段口径不一致。

### 3.3 搜索分层

Next 负责分层和排序：

| Section | 数量 | 说明 |
|---------|------|------|
| `primary` | 1 | UI 标题为“精准匹配”，不走向量 |
| `similar` | 3 | UI 标题为“相关表达”，支持换一批 |
| `recommended` | 4 | UI 标题为“继续探索”，支持换一批 |

一级精准结果：

```text
exact / 繁简 exact / prefix / like / full text
```

二级和三级使用后端原始文档里的字段级向量能力。二级保持直接使用用户搜索文本向量：

```text
用户 query
  -> 调阿里云 qwen3-vl-embedding
  -> 得到 1024 维 query vector
  -> 查 corpus_field_embeddings(field_type=doc)
  -> 生成 similar
  -> 再从 similar 的 doc 向量扩散 recommended
```

排序融合维度：

```text
corpus_field_embeddings
corpus_tags
tag_related
content_categories
热度和运营规则
```

执行口径：

- `primary`：文本精准链路，独立查询。
- `similar`：语义链路，固定使用用户 query vector 查询 `corpus_field_embeddings(field_type='doc')`，再融合已有标签和身份分类。
- `recommended`：语义链路，优先从 similar 结果的 `doc` 向量继续扩散，再融合 `tag_related`、身份分类热门和热度。
- 短 query 的一级精准仍不走向量；短 query 的 similar 仍用 query vector，但需要结合 tag / category 做过滤或加权，减少短文本向量不稳定带来的误召回。

当前 `field_type` 使用范围：

| Section | 当前 `field_type` | 说明 |
|---------|-------------------|------|
| `primary` | 不使用向量 | 直接查 `cantonese_corpus_all.data`，走 exact / prefix / like |
| `similar` | `doc` | 用户搜索文本先调百炼生成 query vector，再在 `corpus_field_embeddings(field_type='doc')` 子空间召回 |
| `recommended` | `doc` | 先取 similar 结果，再使用这些语料的 `doc` 向量继续扩散推荐 |

暂不使用 `headword`、`sentence`、`definition`、`image`、`video`。后续如果要按搜索意图增强，可考虑：完整句子 query 引入 `sentence`，释义/概念 query 引入 `definition`，明确词条名 query 用 `headword` 做辅助。

前端 loading：

- primary 和 semantic 分别请求、分别 loading。
- primary 找不到时，只显示“未找到完全匹配词条”，不阻塞 similar / recommended。
- similar / recommended 分别请求、分别 loading。
- similar / recommended 换一批只刷新对应结果区域；点击二级“换一批”时三级保持当前结果，点击三级“换一批”时二级保持当前结果。
- 三级换一批可使用当前二级批次作为扩散基准，但不因为二级换批自动刷新。

### 3.4 UI

前端负责：

- Search 页面一级大卡片。
- 二级 3 条相似结果。
- 三级 4 条推荐结果。
- 页面标题文案使用“精准匹配 / 相关表达 / 继续探索”，避免向用户暴露一级、二级、三级这类系统术语。
- 二级和三级“换一批”交互。
- 音频、图片、视频等多媒体能力的轻量展示和入口；媒体类型不能只作为标签展示。
- 分享卡片预览弹窗。
- SEO 词条页、分类页、标签页。

---

## 四、双方接口契约

### 4.1 后端需要保证

- `unique_id` 继续作为公开词条 ID。
- `cantonese_corpus_all.id` 可用于内部 join。
- `content_categories` 和 `corpus_category` 可查询语料一级/二级身份分类。
- `corpus_tags` 可查询语料已有标签；P0 前端统一按 `related / medium` 输出。
- `tag_related` 可用于相关标签扩展。
- `corpus_field_embeddings` 可用于二级/三级向量召回；至少需要支持用户 query vector 在 `field_type='doc'` 子空间 KNN 查询相似语料，以及按 similar `corpus_id` 取 `field_type='doc'` 向量继续扩散推荐。
- 前端语义搜索固定使用用户 query 实时生成的 1024 维向量查询 `corpus_field_embeddings(field_type='doc')`，不依赖 primary 必然存在。
- 当前不强依赖 `tags.embedding` 和相似标签向量；如果 similar / recommended 效果不够，再把相似标签下的语料加入召回池。
- 贡献者可通过 `cantonese_corpus_update_history` 批量聚合。

### 4.2 前端需要保证

- 不在浏览器暴露 `SUPABASE_SERVICE_ROLE_KEY`。
- 不把旧 `identity_category_l1` / `identity_category_l2` 当作真实字段使用。
- 不把 `cantonese_corpus_all.tags` 当作新标签治理来源。
- `batchToken` 作为不透明字符串处理，前端只原样传回。
- 向量召回失败或缺少百炼 key 时，仍可用标签、分类、热门词兜底，并把 semantic 状态标记为 `fallback`。

---

## 五、待实现清单

实际实施状态以 `implementation-progress.md` 为准；本节只保留前后端契约层面的任务边界。

### 后端

- [ ] 确认 `corpus_category.source` 是否已包含 `ai/import/rule/manual`。
- [ ] 提供批量查询 entryIdentity 所需字段的 SQL 或 RPC。
- [x] 提供 `corpus_field_embeddings` 可用索引和查询示例。

### 暂缓增强

- [ ] `corpus_category.confidence`
- [ ] `corpus_category.batch_id`
- [ ] `corpus_tags.tag_role`
- [ ] `corpus_tags.relevance_level`

### 前端 / Next

- [x] 新增 `/api/search/entries` 第一版。
- [x] 实现 `entryIdentity` 聚合器第一版。
- [x] 实现 primary / similar / recommended 分层第一版。
- [x] 二级/三级接入 `corpus_field_embeddings` 字段级向量召回。
- [x] 实现二级和三级换一批第一版。
- [x] 改造 Search UI。
- [x] 改造分享卡片预览。
- [ ] 规划 SEO 页面。

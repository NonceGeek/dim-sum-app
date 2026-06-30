# 标签与身份展示口径

## 一、结论

新版搜索里不要把旧 `note` 当作一套正式标签体系。更准确的口径是：

```text
note 里的标签 = 历史原材料
corpus_tags = 清洗后的正式语料标签
tag_related = 标签之间的相关关系，用于扩展标签和推荐语料
```

前端展示和推荐应以新表为准：

- 关键标签：来自 `corpus_tags join tags`。
- 推荐 / 扩展标签：由 `tag_related` 基于关键标签推导。
- 旧 `note.context`：只做结构化展示字段 fallback，例如粤拼、释义、音频，不作为标签治理来源。

## 二、三类“标签相关数据”的区别

### 2.1 旧 `note` 标签

旧语料里可能在 `cantonese_corpus_all.note` 中包含标签数据。后端已经用这些历史数据做过清洗、去重和标准化。

它的定位是：

```text
导入来源 / 原始材料
```

它不适合前端直接展示或继续作为新搜索的业务标签来源，原因是：

- 字段形态不统一。
- 可能和新标签表重复。
- 没有 `slug`、`facet`、`status`、`corpus_count` 等治理字段。
- 不能支撑运营后续手动维护。

### 2.2 正式关键标签

正式标签关系由两张表表达：

```text
tags
corpus_tags
```

其中：

- `tags` 是标签词表，包含 `slug`、`name`、`facet`、`gloss`、`embedding` 等信息。
- `corpus_tags` 是语料与标签的多对多关系。

前端 `entryIdentity.tags.related` 当前对应的就是这类标签。虽然字段名叫 `related`，但产品展示上更适合叫“关键标签”或“标签”。

### 2.3 推荐 / 扩展标签

推荐标签不是直接挂在语料上的标签，而是运行时由 `tag_related` 推导：

```text
语料已有标签
  -> tag_related
  -> 相关标签集合
  -> 排除语料已有标签
  -> 按 method 和 score 加权排序
```

`tag_related.method` 有三类信号：

| method | 含义 | 使用建议 |
|--------|------|----------|
| `cooc` | 标签共现 | 数据量足够时稳定，适合补充相关性 |
| `semantic` | 标签释义向量相似 | 适合冷启动，但短标签可能漂移 |
| `manual` | 运营手动配置 | 权重最高，适合运营干预 |

前端 `entryIdentity.tags.recommended` 当前对应这类扩展标签。搜索结果页可以展示这类推荐标签，但当前 UI 先隐藏关键标签和推荐标签，避免一级精准结果信息过载；推荐算法仍可以使用它作为召回来源。

## 三、搜索结果 UI 口径

### 3.1 精准匹配

精准匹配应补齐原型里的身份信息，但不做表格化展示。

建议展示：

- 来源语料集：`entry.source.categoryDisplayName || entry.source.categoryName`
- 一级分类：`entry.category.primary.name`
- 二级分类：`entry.category.secondary.name`
- 贡献者：`entry.source.contributorIds`
- Unique ID：`entry.entryId`
- 关键标签：`entry.tags.related`，当前 UI 先隐藏
- 推荐标签：`entry.tags.recommended`，当前 UI 先隐藏

不建议默认展示旧 `note` 标签。旧 `note` 标签只作为导入原材料，不进入新版标签 UI。

### 3.2 二级相似结果

二级卡片以“相关表达”为主，不展示完整身份表。

当前展示：

- 词条名
- 粤拼
- 简短释义
- 媒体入口
- 关键标签
- 分类 / 来源的简短提示

后续如果需要解释推荐原因，需要接口返回结构化 reason，例如：

```json
{
  "reason": {
    "type": "same_tag",
    "label": "同标签：求职场景"
  }
}
```

### 3.3 三级推荐结果

三级推荐可以使用相似标签下的语料作为候选来源。UI 上关键标签和推荐标签需要分组展示，不能把推荐标签直接混入语料关键标签。

推荐候选来源建议：

```text
similar 结果 doc 向量扩散
tag_related 下的语料
同二级分类语料
同一级分类热门语料
```

## 四、推荐逻辑口径

当前可用信号：

- 用户 query vector 查询 `corpus_field_embeddings(field_type='doc')`
- similar 结果的 doc 向量扩散
- `corpus_tags` 同标签
- `tag_related` 相似标签下的语料
- `corpus_category` 同一级 / 同二级分类
- 热度字段：`view_num`、`bookmark_num`、`liked_num`

P0 推荐逻辑可以继续使用这些信号混排；下一阶段如果需要调优，建议把 `matchSource / reason` 一起返回，便于 UI 展示和排序排查。

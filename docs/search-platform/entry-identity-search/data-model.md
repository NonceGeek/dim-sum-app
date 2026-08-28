# 词条身份信息数据模型

## 一、设计原则

词条身份信息不另起独立主表，第一阶段基于现有语料模型增强：

```text
cantonese_corpus_all = 词条主实体
unique_id = 对外公开词条 ID
data = 词条内容
note / structured_note = 身份扩展信息
category = 当前分类
content_categories / corpus_category = 词条身份二级分类
tags / corpus_tags / tag_related = 标签字典、语料标签关系、相关标签
```

对外接口可以命名为 `entryIdentity`，但它本质是对 `cantonese_corpus_all` 记录的聚合视图。

---

## 二、现有字段映射

| PRD 字段 | 现有字段 / 来源 | 说明 |
|----------|-----------------|------|
| `entry_id` | `cantonese_corpus_all.unique_id` | 继续使用 UUID，避免破坏卡片、互动、编辑链路 |
| `entry_name` | `cantonese_corpus_all.data` | Search 结果标题 |
| `jyutping` | `structured_note.data[].jyutping` / `note.context.pron` | 读音和粤拼统一使用粤拼字段 |
| `meaning` | `structured_note.data[].blocks[type=definition]` / `note.context.meaning` / `note.meaning` | 当前 Search 卡片已从 note 中抽取 snippet |
| `corpus_id` | `cantonese_corpus_all.id` | 后端关系表使用 bigint id；前端和公开链接仍使用 `unique_id` |
| `corpus_name` | `cantonese_categories.nickname` / `category` | 前台已有 nickname 映射 |
| `contributor_id` | `cantonese_corpus_update_history.contributor_user_id` | 原始导入数据没有可信贡献者，前台应展示编辑贡献者 |
| `level_1_category` | `content_categories` parent row | 通过 `corpus_category -> content_categories(level=2) -> parent_id` 聚合 |
| `level_2_category` | `content_categories` child row | 语料只挂二级分类；未归类则无 `corpus_category` 行 |
| `precise_tags` | P0 可为空或由精准命中规则派生 | `corpus_tags.tag_role` 暂缓落库 |
| `related_tags` | `corpus_tags` 全部已有标签 | P0 统一按 `related / medium` 输出 |
| `recommended_tags` | `tag_related` 扩展 | 推荐标签不要求语料本身已有该标签 |
| `cover_image` | `structured_note.data[].blocks[type=image].url` / `note` 内图片字段 | 当前 Search 卡片会按 URL 后缀识别图片 |
| `share_link` | 按 `unique_id` 生成 | 现有格式 `https://card.app.aidimsum.com/?uuid={unique_id}` |
| `status` | `lifecycle_stage` | 当前默认 `draft` |
| `created_at` | `created_at` | 已存在 |
| `updated_at` | `updated_at` | 已存在 |

---

## 三、推荐的 `entryIdentity` 聚合对象

Search、分享卡片、SEO 页面统一消费该对象：

```json
{
  "entryId": "771a1c5-b027",
  "entryName": "相骂冇好口",
  "jyutping": "soeng1maa6 mou4 hou3 hau3",
  "meaning": "多不相让，言语冲突。",
  "source": {
    "categoryName": "zyzdv2",
    "categoryDisplayName": "广州话正音字典",
    "contributor": "User123"
  },
  "category": {
    "primary": {
      "name": "zyzdv2",
      "displayName": "广州话正音字典"
    },
    "secondary": null
  },
  "tags": {
    "precise": [
      { "name": "相骂", "relevanceLevel": "strong" }
    ],
    "related": [
      { "name": "冲突", "relevanceLevel": "medium" }
    ],
    "recommended": [
      { "name": "文化视频", "relevanceLevel": "weak" }
    ]
  },
  "assets": {
    "audioUrl": null,
    "videoUrl": null,
    "coverImage": null
  },
  "stats": {
    "likes": 0,
    "bookmarks": 0,
    "views": 0
  },
  "share": {
    "cardUrl": "https://card.app.aidimsum.com/?uuid=771a1c5-b027",
    "seoUrl": "https://search.aidimsum.com/entries/771a1c5-b027"
  },
  "status": "published"
}
```

---

## 四、标签表结构

本期采用独立标签表，不再把新标签治理能力写回 `cantonese_corpus_all.tags` JSON。旧 `tags` JSON 仅作为导入和兼容来源。

正式表：

```text
tags = 标签词表
corpus_tags = 语料与标签关系
tag_related = 预聚合相关标签
```

`tags.facet` 表示标签自己的维护维度，例如场景、主题、媒体、来源。当前 `corpus_tags` 只表示“语料拥有这个标签”，不再要求本期同时落 `tag_role` 和 `relevance_level`。

枚举建议：

| 字段 | 值 |
|------|----|
| `tags.facet` | `kind` / `media` / `language` / `source` / `scene` / `topic` / `region` / `dialect` / `other` |
| `corpus_tags.tag_role` | 暂缓增强：`precise` / `related` / `recommended` |
| `corpus_tags.relevance_level` | 暂缓增强：`strong` / `medium` / `weak` |
| `corpus_tags.source` | `import` / `manual` / `auto` |
| `tag_related.method` | `cooc` / `semantic` / `manual` |

兼容规则：

- 旧 `cantonese_corpus_all.tags` 字符串标签导入 `tags` 和 `corpus_tags`。
- 旧字符串标签默认进入 `corpus_tags`。
- 前台 P0 聚合时，把 `corpus_tags` 中已有标签统一视为 `related / medium`。
- 前台展示统一消费聚合后的 `entryIdentity.tags.precise / related / recommended`。
- `tag_related` 可用于二级/三级推荐的标签扩展，不直接代表语料已拥有该标签。

---

## 五、一级/二级分类落库方案

本期明确落地 PRD 中的一级/二级分类。但现有 `cantonese_corpus_all.category` 已经承担语料库、dataset 筛选、权限、前台分类 tabs、category nickname 映射等职责，不建议直接改造成语义一级分类。

正式采用独立分类表承载词条语义分类：

```text
content_categories = 两级分类树
corpus_category = 语料到二级分类的单一归属
```

字段含义：

| 字段 | 说明 |
|------|------|
| `cantonese_corpus_all.category` | 现有语料库 / dataset / corpus 分类，继续保留原语义 |
| `content_categories(level=1)` | 词条身份一级分类，用于搜索展示、SEO 聚合、后台治理 |
| `content_categories(level=2)` | 词条身份二级分类，语料只挂二级 |
| `corpus_category` | 语料到二级分类的关系表；一条语料最多一个分类 |

为什么不用 `structured_note.identity` 承载分类：

- 本期需要 Admin 筛选、批量治理和完整度统计。
- Search 分层需要直接按分类过滤或排序。
- SEO 分类页需要稳定查询。
- JSON 字段能快速展示，但不利于长期索引和运营治理。

`corpus_category.source` 当前可按后端现有值使用。后续如要区分来源，建议包含：

```text
ai / import / rule / manual
```

AI 初始化分类的 `confidence` 和 `batch_id` 先暂缓，不作为 P0 前端开发依赖；后续需要运营复核、批量追溯或回滚时再补。

对外 API 仍聚合为：

```json
{
  "category": {
    "primary": { "id": 1, "slug": "idiom", "name": "词语习语" },
    "secondary": { "id": 2, "slug": "idiom-3char", "name": "三字习语" }
  }
}
```

---

## 六、分享统计补充

现有语料表已有：

- `liked_num`
- `bookmark_num`
- `view_num`

但没有通用 `share_num`。建议新增轻量事件表，而不是只在主表加计数：

```text
corpus_share_events
```

字段建议：

| 字段 | 说明 |
|------|------|
| `id` | 自增 ID |
| `corpus_unique_id` | 对应 `cantonese_corpus_all.unique_id` |
| `channel` | web / mobile / seo / card |
| `source_path` | 触发页面 |
| `share_target` | copy_link / download_image / community |
| `user_id` | 登录用户 ID，可为空 |
| `created_at` | 创建时间 |

如需要快速展示分享数，可后续在主表增加 `share_num` 缓存计数。

---

## 七、数据落地优先级

| 优先级 | 工作 |
|--------|------|
| P0 | 定义 `entryIdentity` 解析函数，统一从现有字段聚合身份信息 |
| P0 | 接入 `content_categories` / `corpus_category` 分类关系 |
| P0 | 接入 `tags` / `corpus_tags` / `tag_related` 标签关系 |
| P1 | Admin Corpus 页面支持编辑身份信息、一级/二级分类和结构化标签 |
| P1 | Next `/api/search/entries` 直连 Supabase RPC 并消费 `entryIdentity` |
| P2 | 分享事件表与分享统计 |
| P2 | SEO 页面所需 meta 字段 |
| P3 | 分类字典表、slug 和分类树治理增强 |

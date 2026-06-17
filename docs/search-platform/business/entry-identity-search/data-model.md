# 词条身份信息数据模型

## 一、设计原则

词条身份信息不另起独立主表，第一阶段基于现有语料模型增强：

```text
cantonese_corpus_all = 词条主实体
unique_id = 对外公开词条 ID
data = 词条内容
note / structured_note = 身份扩展信息
category = 当前分类
tags = 当前标签
```

对外接口可以命名为 `entryIdentity`，但它本质是对 `cantonese_corpus_all` 记录的聚合视图。

---

## 二、现有字段映射

| PRD 字段 | 现有字段 / 来源 | 说明 |
|----------|-----------------|------|
| `entry_id` | `cantonese_corpus_all.unique_id` | 继续使用 UUID，避免破坏卡片、互动、编辑链路 |
| `entry_name` | `cantonese_corpus_all.data` | Search 结果标题 |
| `pronunciation` | `note.context.pron` / `note.context.pinyin` / `structured_note.pronunciation` | 需要建立解析优先级 |
| `jyutping` | `note.context.pron` / `structured_note.jyutping` | 现有代码中 `pron` 常作为粤拼展示 |
| `meaning` | `note.context.meaning` / `note.meaning` / `structured_note.meaning` | 当前 Search 卡片已从 note 中抽取 snippet |
| `corpus_id` | `category` 或扩展字段 | 当前没有独立语料集 ID 概念，需确认是否把分类视为来源语料集 |
| `corpus_name` | `cantonese_categories.nickname` / `category` | 前台已有 nickname 映射 |
| `contributor_id` | `note.contributor` / `note.context.author` / 扩展字段 | 当前不是稳定用户 ID |
| `level_1_category` | 新增 `identity_category_l1` | 本期落地，表示词条语义一级分类 |
| `level_2_category` | 新增 `identity_category_l2` | 本期落地，表示词条语义二级分类 |
| `precise_tags` | `tags` 扩展结构 | 当前 `tags` 是扁平 JSON |
| `related_tags` | `tags` 扩展结构 | 需要新增类型 |
| `recommended_tags` | `tags` 扩展结构 | 需要新增类型 |
| `cover_image` | `note` 内图片字段 / `structured_note.cover_image` | 当前 Search 卡片会按 URL 后缀识别图片 |
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
  "pronunciation": "xiāng mà móu hǎo kǒu",
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

## 四、标签结构扩展

当前 `tags` 是 JSON，Search 卡片直接按字符串数组渲染：

```json
["相骂", "冲突", "争吵"]
```

为了支持 PRD，建议新结构兼容旧结构：

```json
[
  {
    "name": "相骂",
    "type": "precise",
    "relevanceLevel": "strong",
    "source": "manual"
  },
  {
    "name": "冲突",
    "type": "related",
    "relevanceLevel": "medium",
    "source": "ai"
  }
]
```

兼容规则：

- 旧字符串标签默认视为 `related + medium`。
- 前台展示时仍可渲染 `name`。
- 后台保存时统一保存结构化格式。

枚举建议：

| 字段 | 值 |
|------|----|
| `type` | `precise` / `related` / `recommended` |
| `relevanceLevel` | `strong` / `medium` / `weak` |
| `source` | `manual` / `ai` / `import` |

---

## 五、一级/二级分类落库方案

本期明确落地 PRD 中的一级/二级分类。但现有 `cantonese_corpus_all.category` 已经承担语料库、dataset 筛选、权限、前台分类 tabs、category nickname 映射等职责，不建议直接改造成语义一级分类。

建议新增字段承载词条语义分类：

```text
cantonese_corpus_all.identity_category_l1
cantonese_corpus_all.identity_category_l2
```

字段含义：

| 字段 | 说明 |
|------|------|
| `category` | 现有语料库 / dataset / corpus 分类，继续保留原语义 |
| `identity_category_l1` | 词条身份信息一级分类，用于搜索展示、SEO 聚合、后台治理 |
| `identity_category_l2` | 词条身份信息二级分类，必须挂靠在一级分类下 |

为什么不用 `structured_note.identity` 承载分类：

- 本期需要 Admin 筛选、批量治理和完整度统计。
- Search 分层需要直接按分类过滤或排序。
- SEO 分类页需要稳定查询。
- JSON 字段能快速展示，但不利于长期索引和运营治理。

分类字典建议：

```text
corpus_identity_categories
```

字段建议：

| 字段 | 说明 |
|------|------|
| `id` | 分类 ID |
| `name` | 分类名称 |
| `level` | 1 / 2 |
| `parent_id` | 二级分类所属一级分类 |
| `slug` | SEO slug |
| `description` | 分类说明 |
| `sort_order` | 排序 |
| `status` | draft / published / offline |

如果为了首期速度不建分类字典，也至少应在 `cantonese_corpus_all` 增加两个文本字段，并在 Admin 中通过枚举配置限制可选值。

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
| P0 | 新增 `identity_category_l1` / `identity_category_l2` 字段或等价关系表 |
| P0 | 结构化标签兼容方案 |
| P1 | Admin Corpus 页面支持编辑身份信息、一级/二级分类和结构化标签 |
| P1 | Next `/api/search/entries` 直连 Supabase RPC 并消费 `entryIdentity` |
| P2 | 分享事件表与分享统计 |
| P2 | SEO 页面所需 meta 字段 |
| P3 | 分类字典表、slug 和分类树治理增强 |

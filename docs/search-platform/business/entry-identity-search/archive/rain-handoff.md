# @RAiN 对接说明

> 注意：本文是早期给 @RAiN 的对接草稿，部分字段口径已被后端最新方案替代。最新落库方案以 `语料身份需求.md` 和 `data-model.md` 为准：分类使用 `content_categories` / `corpus_category`，标签使用 `tags` / `corpus_tags` / `tag_related`，不再新增 `identity_category_l1` / `identity_category_l2` 字段。

## 一、对接目标

@RAiN 侧主要负责“词条身份信息数据底座”。

 在`cantonese_corpus_all`表基础上补充可被 搜索、SEO、分享卡片复用的结构化字段，并兼容旧数据、旧搜索。

---

## 二、需要 @RAiN 确认的事项

### 2.1 身份字段落库方案

请确认以下字段如何设计进数据库：

| 字段 | 建议 | 说明 |
|------|------|------|
| `unique_id` | 继续复用 | 词条公开唯一 ID，不新增 entry id |
| `category` | 保持原语义 | 继续表示语料库 / dataset，不改成语义分类 |
| `identity_category_l1` | 本期新增 | 词条身份一级分类 |
| `identity_category_l2` | 本期新增 | 词条身份二级分类 |
| `structured_note.identity` | 本期新增或规范化 | 读音、粤拼、释义、贡献者、封面、音视频等身份字段 |
| `tags` | 结构化兼容 | 从字符串数组升级为结构化标签，同时兼容旧数据 |

需要 @RAiN 输出：

- 是否直接在 `cantonese_corpus_all` 增加 `identity_category_l1` / `identity_category_l2`。
- 是否新增身份分类字典表，例如 `corpus_identity_categories`。
- 是否需要给一级/二级分类加 slug、排序和状态。

---

### 2.2 `structured_note.identity` 字段规则

建议结构：

```json
{
  "identity": {
    "pronunciation": "",
    "jyutping": "",
    "meaning": "",
    "contributor": "",
    "coverImage": "",
    "audioUrl": "",
    "videoUrl": ""
  }
}
```

需要 @RAiN 确认：

- 读音字段从哪里取。
- 粤拼字段从哪里取。
- 释义字段从哪里取。
- 贡献者字段从哪里取。
- 封面图、音频、视频字段从哪里取。
- 不同语料类型的 `note` 结构如何兼容。

建议解析优先级：

```text
structured_note.identity
  -> note.context
  -> note.contributor
  -> null
```

---

### 2.3 结构化 tags 规则

当前 `tags` 可能是字符串数组：

```json
["相骂", "冲突", "争吵"]
```

新需求建议升级为：

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

需要 @RAiN 确认：

- 是否继续存储在 `cantonese_corpus_all.tags`。
- 旧字符串标签如何迁移。
- `type` 是否固定为：
  - `precise`
  - `related`
  - `recommended`
- `relevanceLevel` 是否固定为：
  - `strong`
  - `medium`
  - `weak`
- `source` 是否固定为：
  - `manual`
  - `ai`
  - `import`

兼容建议：

```text
旧字符串标签默认视为:
type = related
relevanceLevel = medium
source = import
```

---

### 2.4 搜索接口配合边界

Supabase RPC、搜索排序、标签召回和推荐召回不归 @RAiN 主责，这部分由 Search / Next 后端负责。

@RAiN 只需要保证搜索侧可以读取到稳定字段：

- `unique_id`
- `data`
- `note`
- `structured_note`
- `category`
- `identity_category_l1`
- `identity_category_l2`
- `tags`
- `lifecycle_stage`

换句话说，@RAiN 的交付物是“数据字段和数据口径可用”，不是“搜索 RPC 怎么实现”。

---

### 2.5 旧数据治理

需要 @RAiN 给出初始化和治理方案：

- 旧数据如何补 `identity_category_l1`。
- 旧数据如何补 `identity_category_l2`。
- 旧字符串 `tags` 如何迁移成结构化标签。
- 缺失读音、粤拼、释义、贡献者、标签的记录如何识别。
- AI 初分类结果写入哪里。
- 人工复核后如何更新状态。
- 哪些字段由 AI 建议，哪些字段必须人工确认。

建议缺失字段识别：

| 缺失项 | 判断方式 |
|--------|----------|
| 缺一级分类 | `identity_category_l1` 为空 |
| 缺二级分类 | `identity_category_l2` 为空 |
| 缺释义 | `structured_note.identity.meaning` 和旧 `note` 兜底均为空 |
| 缺读音 | `structured_note.identity.pronunciation` 和旧字段兜底均为空 |
| 缺粤拼 | `structured_note.identity.jyutping` 和旧字段兜底均为空 |
| 缺标签 | `tags` 为空数组 |
| 旧标签格式 | `tags` 中存在 string item |

---

## 三、建议给 @RAiN 的直接话术

```text
@RAiN，这次你这边主要负责《词条身份信息》（语料库）的数据库。

你是要新建独立主表，还是基于 cantonese_corpus_all 做增强。

unique_id 可以继续作为公开词条 ID，现有 category 继续表示语料库。

本期需要你确认：
1. 以下字段如何设计进数据库：
  a.identity_category_l1(本期新增:词条身份一级分类);
  b.identity_category_l2(本期新增:词条身份二级分类);
  c.structured_note.identity(本期新增或规范化:读音、粤拼、释义、贡献者、封面、音视频等身份字段);
  d.tags(结构化兼容:从字符串数组升级为结构化标签，同时兼容旧数据);
  e.是否新增身份分类字典表，例如 `corpus_identity_categories`;
  f.是否需要给一级/二级分类加 slug、排序和状态。
2.structured_note.identity 的字段结构和旧 note 兼容规则；
3.旧数据补齐、分类初始化、标签迁移、缺失字段识别方案，是否用ai打标，哪些字段必须人工确认。

另外搜索方案先用全文检索还是本期就直接上向量数据库？

另外你可以预估一下这个需求完成时间吗？ddl是7.10包括我这边的对接和测试。
```

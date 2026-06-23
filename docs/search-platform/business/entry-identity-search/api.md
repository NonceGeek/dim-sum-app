# 词条身份信息与搜索分发接口设计

## 概述

现有 Search 前台直接通过 `backendFetch` 调用 Deno backend：

```text
GET /v2/text_search?table_name=...&column=data&keyword=...
GET /v2/corpus_item?unique_id=...
```

本期建议把新搜索能力放在 Next Route Handler 中，由 Next 服务端直连 Supabase RPC，负责把搜索结果、本地 `cantonese_categories`、互动统计、分享链接、一级/二级分类和标签结构聚合成 `entryIdentity` 与分层搜索结果。

Deno backend 的 `/v2/text_search` 保留为历史兼容接口，不建议在本期继续扩展身份信息、分享、SEO 和后台治理逻辑。

### 架构取舍

| 方案 | 结论 | 原因 |
|------|------|------|
| Next Route Handler 直连 Supabase RPC | 本期推荐 | 性能少一跳、上线快、Search UI/Admin/SEO/分享都在 Next 内，便于统一交付 |
| Deno 新增 `/v3/text_search` | 可作为后续搜索服务化方向 | 搜索逻辑集中，但本期还要额外维护 Deno 发布和 Next 适配 |
| Next 调 Deno `/v2/text_search` 后聚合 | 仅适合兜底 | 多一次网络调用，且新旧逻辑容易分裂 |

安全边界：

- `SUPABASE_SERVICE_ROLE_KEY` 只能在 Next 服务端 Route Handler 中使用。
- 环境变量不得带 `NEXT_PUBLIC_` 前缀。
- Client Component 不得直接调用 Supabase service role key。
- 浏览器只调用 `/api/search/*`，不直接访问 Supabase RPC。

---

## 一、现有接口

### 1.1 外部文本搜索

当前调用位置：`lib/api/search.ts`

```text
GET {BACKEND_URL}/v2/text_search?table_name={table_name}&column=data&keyword={keyword}
```

当前返回：`SearchResult[]`

核心字段：

| 字段 | 说明 |
|------|------|
| `id` | 内部 ID |
| `unique_id` | 公开 UUID |
| `data` | 词条内容 |
| `note` | JSON 扩展内容 |
| `category` | 分类名 |
| `tags` | 标签数组 |
| `editable_level` | 编辑权限等级 |
| `created_at` | 创建时间 |

### 1.2 外部单条语料查询

```text
GET {BACKEND_URL}/v2/corpus_item?unique_id={unique_id}
```

当前用于：

- `getCorpusItemByUniqueId`
- 站内卡片生成器
- 搜索结果详情补充

### 1.3 本地分类接口

```text
GET {BACKEND_URL}/corpus_categories
GET {BACKEND_URL}/v2/corpus_category?name={category}
```

当前用于：

- Search 页 category nickname 映射
- Search 结果卡片 related apps / links 展示
- 数据集筛选

---

## 二、建议新增前台聚合接口

### 2.1 搜索词条聚合接口

#### 接口信息

- **URL**: `/api/search/entries`
- **方法**: `GET`
- **认证**: 可选

#### 请求参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `q` | string | 是 | - | 搜索关键词 |
| `dataset` | string | 否 | `all` | 现有 Search URL 中的 dataset，逗号分隔 |
| `section` | string | 否 | `all` | `all` / `similar` / `recommended`。首次搜索用 `all`，换一批时指定 section |
| `batchSize` | number | 否 | 按 section | 每批返回数量。`similar` 默认 3，`recommended` 默认 4 |
| `batchToken` | string | 否 | - | 换一批游标，由上一次响应返回 |
| `includeRecommendations` | boolean | 否 | `true` | 是否返回二级/三级结果 |

#### 聚合逻辑

```text
接收 q/dataset
  -> 使用 tify/sify 生成繁简搜索词
  -> Next 服务端调用 Supabase RPC search_cantonese_corpus
  -> 合并繁简结果并按 unique_id 去重
  -> 根据 dataset 过滤现有语料库 category
  -> 排除 test category
  -> 读取 content_categories / corpus_category 身份分类
  -> 读取 tags / corpus_tags / tag_related 标签关系
  -> 批量聚合 cantonese_corpus_update_history 编辑贡献者
  -> 读取互动统计
  -> 标准化每条结果为 entryIdentity
  -> 按精准命中规则分出 primary
  -> 按 corpus_tags / tag_related / content_categories 生成 similar
  -> 按 recommended tags / tag_related / 热门词生成 recommended
  -> 返回分层结果
```

#### 成功响应

首次搜索返回三个 section 的首屏结果：

```json
{
  "query": "好",
  "legacyResults": [],
  "sections": {
    "primary": {
      "item": {
          "entryIdentity": {
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
            "related": [],
            "recommended": []
          },
          "share": {
            "cardUrl": "https://card.app.aidimsum.com/?uuid=771a1c5-b027",
            "seoUrl": "https://search.aidimsum.com/entries/771a1c5-b027"
          },
          "status": "published"
        },
        "match": {
          "section": "primary",
          "type": "exact",
          "score": 1,
          "reason": "完全匹配"
        }
      }
    },
    "similar": {
      "items": [],
      "batch": {
        "batchSize": 3,
        "nextBatchToken": "similar:2",
        "hasNextBatch": true
      }
    },
    "recommended": {
      "items": [],
      "batch": {
        "batchSize": 4,
        "nextBatchToken": "recommended:2",
        "hasNextBatch": true
      }
    }
  }
}
```

刷新原则：

- `primary` 是答案区，只返回 1 个最佳结果。
- `similar` 使用“换一批相似结果”，按 section 单独刷新并替换当前结果，一次返回 3 条。
- `recommended` 使用“换一批推荐”，按 section 单独刷新并替换当前结果，一次返回 4 条。
- 前端不展示传统分页，也不做追加加载。
- `batchToken` 可以在 P0 内部映射为 page/offset，后续接入向量或混合排序后可映射为 cursor。

换一批示例：

```text
GET /api/search/entries?q=好&dataset=all&section=similar&batchToken=similar:2&batchSize=3
GET /api/search/entries?q=好&dataset=all&section=recommended&batchToken=recommended:2&batchSize=4
```

后端实现说明：

```text
batchToken 是不透明字符串，前端只负责原样传回。
P0 可编码 page/offset。
P1/P2 可编码 vector score、last unique_id、seed 或推荐池 offset。
```

兼容策略：

- `legacyResults` 可在迁移期返回原始 `SearchResult[]`，便于前端回退。
- 如果新接口不可用，前端可回退到现有 Deno `/v2/text_search` 扁平列表。

#### Route Handler 位置建议

```text
app/api/search/entries/route.ts
```

伪代码：

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tify, sify } from "@aqzhyi/chinese-conv";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("q") ?? "";
  const dataset = searchParams.get("dataset") ?? "all";

  const [traditionalResults, simplifiedResults] = await Promise.all([
    supabase.rpc("search_cantonese_corpus", { search_term: tify(keyword) }),
    supabase.rpc("search_cantonese_corpus", { search_term: sify(keyword) }),
  ]);

  if (traditionalResults.error || simplifiedResults.error) {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  let merged = [
    ...(traditionalResults.data ?? []),
    ...(simplifiedResults.data ?? []),
  ];

  merged = Array.from(
    new Map(merged.map((item) => [item.unique_id, item])).values(),
  );

  if (dataset !== "all") {
    const allowed = dataset.split(",").filter(Boolean);
    merged = merged.filter((item) => allowed.includes(item.category));
  }

  merged = merged.filter((item) => !item.category?.includes("test"));

  return NextResponse.json(buildSearchSections(keyword, merged));
}
```

---

### 2.2 获取词条身份信息

#### 接口信息

- **URL**: `/api/search/entries/{uniqueId}`
- **方法**: `GET`
- **认证**: 可选

#### 数据来源

- 本地 `cantonese_corpus_all`
- 本地 `cantonese_categories`
- 本地互动统计接口逻辑
- 必要时可临时兼容外部 `/v2/corpus_item?unique_id=`

#### 成功响应

```json
{
  "entryIdentity": {
    "entryId": "771a1c5-b027",
    "entryName": "相骂冇好口",
    "meaning": "多不相让，言语冲突。",
    "share": {
      "cardUrl": "https://card.app.aidimsum.com/?uuid=771a1c5-b027",
      "seoUrl": "https://search.aidimsum.com/entries/771a1c5-b027"
    }
  },
  "rawCorpus": {
    "unique_id": "771a1c5-b027",
    "data": "相骂冇好口",
    "category": "zyzdv2",
    "note": {},
    "tags": []
  }
}
```

---

## 三、分享卡片接口

### 3.1 获取分享卡片数据

#### 接口信息

- **URL**: `/api/search/entries/{uniqueId}/share-card`
- **方法**: `GET`
- **认证**: 可选

#### 返回

```json
{
  "entryIdentity": {},
  "card": {
    "externalUrl": "https://card.app.aidimsum.com/?uuid=771a1c5-b027",
    "internalGeneratorUrl": "/inner-apps/card-generator?uuid=771a1c5-b027",
    "downloadable": true
  }
}
```

### 3.2 记录分享事件

#### 接口信息

- **URL**: `/api/search/entries/{uniqueId}/share-events`
- **方法**: `POST`
- **认证**: 可选

#### 请求体

```json
{
  "channel": "web",
  "sourcePath": "/search?q=好",
  "shareTarget": "copy_link"
}
```

#### 说明

该接口建议写入新增 `corpus_share_events` 表。若短期不建表，也可先埋点到现有分析系统。

---

## 四、Admin 接口增强

### 4.1 现有语料列表接口增强

当前：

```text
GET /api/admin/corpus
```

建议新增请求参数：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| `lifecycleStage` | string | 生命周期筛选 |
| `missingIdentityField` | string | 缺失字段筛选，如 `meaning`、`jyutping` |
| `tagType` | string | precise / related / recommended |
| `tagRelevance` | string | strong / medium / weak |
| `hasShareCard` | boolean | 是否有分享卡片 |

建议新增返回字段：

```json
{
  "corpus": [
    {
      "id": 1,
      "uniqueId": "771a1c5-b027",
      "data": "相骂冇好口",
      "identitySummary": {
        "meaning": "多不相让，言语冲突。",
        "jyutping": "soeng1maa6 mou4 hou3 hau3",
        "contributor": "User123",
        "completeness": 0.82
      },
      "category": "zyzdv2",
      "categoryDisplayName": "广州话正音字典",
      "tags": [],
      "lifecycleStage": "published",
      "share": {
        "cardUrl": "https://card.app.aidimsum.com/?uuid=771a1c5-b027",
        "seoUrl": "https://search.aidimsum.com/entries/771a1c5-b027"
      }
    }
  ]
}
```

### 4.2 更新词条身份信息

建议新增：

```text
PATCH /api/admin/corpus/{uniqueId}/identity
```

请求体：

```json
{
  "identity": {
    "jyutping": "soeng1maa6 mou4 hou3 hau3",
    "meaning": "多不相让，言语冲突。",
    "secondaryCategoryId": 12
  }
}
```

写入建议：

```text
structured_note.data[].jyutping
structured_note.data[].blocks[type=definition]
corpus_category
```

原因：

- 避免破坏不同类别现有 `note` 结构。
- 读音和粤拼统一使用粤拼字段。
- 分类不写入 JSON，使用 `content_categories` / `corpus_category` 关系表。
- 贡献者不写入 `structured_note`，由 `cantonese_corpus_update_history` 聚合。

### 4.3 更新结构化标签

建议新增：

```text
PATCH /api/admin/corpus/{uniqueId}/tags
```

请求体：

```json
{
  "tags": [
    {
      "name": "相骂",
      "tagRole": "precise",
      "relevanceLevel": "strong",
      "source": "manual"
    }
  ]
}
```

写入：

```text
tags
corpus_tags
```

其中 `tags` 保存标签词表，`corpus_tags` 保存语料和标签的关联关系。当前 P0 先不依赖 `corpus_tags.tag_role` 和 `corpus_tags.relevance_level`，接口聚合时统一把已有标签输出为 `related / medium`；后续如字段落库，再支持 precise / related / recommended 和 strong / medium / weak 的精细编辑。

---

## 五、分类接口增强

当前：

```text
GET /api/admin/categories
PATCH /api/admin/categories
```

建议新增：

```text
PATCH /api/admin/categories/{name}
```

支持更新：

- `nickname`
- `description`
- `recommend_words`
- `related`
- `if_in_all_data`
- `is_public`
- SEO slug 或公开路径

若后续确认做二级分类，再新增 parent 字段或分类树接口。

---

## 六、SEO 数据接口

### 6.1 词条 SEO 数据

#### 接口信息

- **URL**: `/api/search/seo/entries/{uniqueId}`
- **方法**: `GET`
- **认证**: 不需要

#### 返回

```json
{
  "entryIdentity": {},
  "meta": {
    "title": "相骂冇好口 - DimSum 粤语词条",
    "description": "了解粤语词条相骂冇好口的粤拼、来源、分类与相关表达。",
    "canonical": "https://search.aidimsum.com/entries/771a1c5-b027"
  },
  "relatedEntries": []
}
```

---

## 七、错误响应

统一错误格式建议：

```json
{
  "error": {
    "code": "CORPUS_NOT_FOUND",
    "message": "Corpus item not found"
  }
}
```

常见错误：

| HTTP 状态 | code | 说明 |
|-----------|------|------|
| 400 | `INVALID_REQUEST` | 请求参数错误 |
| 401 | `UNAUTHORIZED` | 未登录或 token 失效 |
| 403 | `FORBIDDEN` | 无权限 |
| 404 | `CORPUS_NOT_FOUND` | 语料不存在 |
| 409 | `DUPLICATE_CORPUS` | 语料重复 |
| 422 | `INVALID_TAG_FORMAT` | 标签结构无效 |

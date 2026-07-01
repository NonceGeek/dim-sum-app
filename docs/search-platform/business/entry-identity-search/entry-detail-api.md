# 词条详情数据接口

本文档说明语料详情页的数据来源，以及其他开发者如何复用同一份词条详情数据。

## 一、当前页面数据来源

词条详情页：

```text
main/app/[locale]/(home)/entries/[entryId]/page.tsx
```

当前不是通过浏览器请求 JSON API 获取数据，而是在 Next Server Component 中直接读取服务端数据：

```text
/entries/{entryId}
  -> fetchEntryIdentityByUniqueId(entryId)
  -> fetchEntryIdentitiesByUniqueIds([entryId])
  -> public.get_entry_identities(uuid[])
  -> buildEntryIdentity()
```

对应代码：

```ts
import { fetchEntryIdentityByUniqueId } from "@/lib/search/entry-query";

const entry = await fetchEntryIdentityByUniqueId(entryId);
```

因此：

- `/entries/{entryId}` 是页面路由，不是 JSON 接口。
- `/api/entries/{entryId}` 是给其他应用使用的 JSON Route Handler。
- `public.get_entry_identities(uuid[])` 是当前详情页、搜索结果、分享卡片可复用的底层数据聚合 RPC。
- 如果其他开发者在 Next 服务端代码中使用，优先复用 `fetchEntryIdentityByUniqueId` 或 `fetchEntryIdentitiesByUniqueIds`。
- 如果其他服务需要跨项目调用，优先通过 Supabase RPC 调用 `get_entry_identities`。

## 二、HTTP Route Handler

### 2.1 请求

```http
GET /api/entries/{entryId}
```

示例：

```http
GET /api/entries/81972ccc-ef47-434c-a572-be44bb69d93d
```

参数：

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| `entryId` | path | 是 | 公开词条 ID，对应 `cantonese_corpus_all.unique_id` |

### 2.2 响应

成功响应：

```json
{
  "entry": {
    "corpusId": 38356,
    "entryId": "81972ccc-ef47-434c-a572-be44bb69d93d",
    "entryName": "风扇底下倾偈，讲风凉话",
    "editableLevel": 0,
    "jyutping": "fung1 sin3 dai2 haa6 king1 gai2, gong2 fung1 loeng4 waa6",
    "meaning": "在风扇底下聊天，说风凉话。",
    "source": {
      "categoryName": "example",
      "categoryDisplayName": "粤语万句多用途生活场景有声语料集",
      "contributorIds": []
    },
    "category": {
      "primary": {
        "id": 1,
        "slug": "daily-life",
        "name": "生活情景对话"
      },
      "secondary": {
        "id": 2,
        "slug": "chat",
        "name": "闲聊场景"
      }
    },
    "tags": {
      "precise": [],
      "related": [],
      "recommended": []
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
      "cardUrl": "https://card.app.aidimsum.com/?uuid=81972ccc-ef47-434c-a572-be44bb69d93d",
      "seoUrl": "/entries/81972ccc-ef47-434c-a572-be44bb69d93d"
    },
    "status": "normalized",
    "createdAt": "2026-01-27T13:30:14.373Z",
    "updatedAt": "2026-03-30T02:39:31.859Z"
  }
}
```

### 2.3 错误码

| HTTP 状态 | `code` | 说明 |
|-----------|--------|------|
| `400` | `INVALID_ENTRY_ID` | `entryId` 缺失或不是 UUID |
| `404` | `ENTRY_NOT_FOUND` | 找不到对应词条 |
| `500` | - | 服务端异常 |

错误响应示例：

```json
{
  "error": "Entry not found",
  "code": "ENTRY_NOT_FOUND"
}
```

### 2.4 使用边界

当前接口适合：

- 同源 Web 前端调用。
- 其他服务端应用调用。
- App、小程序、运营工具调用。
- 其他 Web 应用跨域调用。

当前接口已开放跨域 CORS：

```text
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

因为当前使用 `Access-Control-Allow-Origin: *`，调用方不要依赖 cookie 凭证。后续如果要按应用做配额、鉴权或私有字段控制，应改为域名白名单或 API Key 鉴权。

## 三、Next 服务端调用

适用场景：

- Server Component
- Route Handler
- Server Action
- 后台脚本

单条查询：

```ts
import { fetchEntryIdentityByUniqueId } from "@/lib/search/entry-query";

const entry = await fetchEntryIdentityByUniqueId(
  "81972ccc-ef47-434c-a572-be44bb69d93d",
);

if (!entry) {
  // not found
}
```

批量查询：

```ts
import { fetchEntryIdentitiesByUniqueIds } from "@/lib/search/entry-query";

const entries = await fetchEntryIdentitiesByUniqueIds([
  "81972ccc-ef47-434c-a572-be44bb69d93d",
  "bcae34bc-9c65-44a9-854a-2327115fea77",
]);
```

批量查询会：

- 去重空值和重复 ID。
- 保持入参顺序返回。
- 自动聚合分类、标签、推荐标签、贡献者、媒体和分享链接。

## 四、Supabase RPC 调用

适用场景：

- 其他后端服务。
- 管理后台服务端。
- 外部开发者服务端。

不要在浏览器直接使用 `SUPABASE_SERVICE_ROLE_KEY`。

```ts
const { data, error } = await supabase.rpc("get_entry_identities", {
  p_unique_ids: ["81972ccc-ef47-434c-a572-be44bb69d93d"],
});

if (error) {
  throw error;
}
```

SQL 等价写法：

```sql
select *
from public.get_entry_identities(
  array['81972ccc-ef47-434c-a572-be44bb69d93d']::uuid[]
);
```

RPC 返回的是数据库聚合行。Next 会再通过 `buildEntryIdentity()` 转成前端统一的 `entryIdentity` 结构。

## 五、统一返回结构

Next 层最终输出的 `EntryIdentity` 结构如下：

```ts
type EntryIdentity = {
  corpusId: number;
  entryId: string;
  entryName: string;
  editableLevel: number;
  jyutping: string | null;
  meaning: string | null;
  source: {
    categoryName: string;
    categoryDisplayName: string | null;
    contributorIds: string[];
  };
  category: {
    primary: EntryCategory | null;
    secondary: EntryCategory | null;
  };
  tags: {
    precise: EntryTag[];
    related: EntryTag[];
    recommended: EntryTag[];
  };
  assets: {
    audioUrl: string | null;
    videoUrl: string | null;
    coverImage: string | null;
  };
  stats: {
    likes: number;
    bookmarks: number;
    views: number;
  };
  share: {
    cardUrl: string;
    seoUrl: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
};
```

分类结构：

```ts
type EntryCategory = {
  id: number;
  slug: string;
  name: string;
};
```

标签结构：

```ts
type EntryTag = {
  id: number;
  slug: string;
  name: string;
  facet: string;
  role: "related" | "recommended";
  relevanceLevel: "medium";
};
```

## 六、字段说明

| 字段 | 说明 |
|------|------|
| `corpusId` | `cantonese_corpus_all.id`，内部 join 用 |
| `entryId` | `cantonese_corpus_all.unique_id`，公开词条 ID |
| `entryName` | 词条展示名，优先取结构化 sentence，并清理导入后缀 |
| `editableLevel` | 来源语料集编辑权限等级，来自 `cantonese_categories.editable_level` |
| `jyutping` | 粤拼，优先取 `structured_note.data[].jyutping` |
| `meaning` | 释义，优先取 `structured_note` 的 `definition` block |
| `source.categoryName` | 原始语料集 category |
| `source.categoryDisplayName` | 语料集展示名，来自 `cantonese_categories.nickname` |
| `source.contributorIds` | 编辑贡献者 ID，来自 `cantonese_corpus_update_history` |
| `category.primary` | 一级分类，来自 `content_categories` |
| `category.secondary` | 二级分类，来自 `content_categories` |
| `tags.related` | 当前语料已挂载标签，来自 `corpus_tags` + `tags` |
| `tags.recommended` | 推荐扩展标签，来自 `tag_related` |
| `assets.audioUrl` | 音频地址，优先取 `structured_note` audio block |
| `assets.videoUrl` | 视频地址，优先取 `structured_note` video block |
| `assets.coverImage` | 图片或封面地址，优先取 `structured_note` image block |
| `stats` | 浏览、收藏、点赞等统计 |
| `share.cardUrl` | 分享卡片地址 |
| `share.seoUrl` | 站内详情页地址 |
| `status` | `lifecycle_stage` |

## 七、底层 RPC 聚合来源

`public.get_entry_identities(uuid[])` 当前聚合以下数据：

| 能力 | 表 / 来源 |
|------|-----------|
| 语料主数据 | `cantonese_corpus_all` |
| 来源语料集展示名和编辑等级 | `cantonese_categories` |
| 一级 / 二级分类 | `corpus_category`、`content_categories` |
| 当前语料标签 | `corpus_tags`、`tags` |
| 推荐扩展标签 | `tag_related` |
| 编辑贡献者 | `cantonese_corpus_update_history` |

推荐扩展标签的排序权重：

```text
manual   = 3.0
cooc     = 1.0
semantic = 0.6
other    = 0.4
```

当前最多返回 6 个 recommended tags。

## 八、Fallback 规则

为了兼容旧数据，Next 聚合层会按以下优先级取展示字段：

```text
structured_note > note.context > null
```

当前 fallback 字段包括：

- `entryName`
- `jyutping`
- `meaning`
- `audioUrl`
- `videoUrl`
- `coverImage`

注意：

- `note.context` 只用于旧数据展示 fallback。
- 分类、标签、推荐标签不以 `note.context` 为正式来源。
- 新标签治理以 `tags`、`corpus_tags`、`tag_related` 为准。

## 九、权限和安全

- 浏览器不要直接调用 Supabase service role key。
- 页面展示可通过 `/entries/{entryId}` 访问。
- JSON 数据可通过 `/api/entries/{entryId}` 获取。
- `/api/entries/{entryId}` 当前开放跨域 CORS，但只返回公开词条详情数据。
- 服务端数据复用优先调用 `fetchEntryIdentityByUniqueId`。
- 跨项目服务端调用优先调用 Supabase RPC `get_entry_identities`。
- `/api/entries/{entryId}` 内部复用同一个 `fetchEntryIdentityByUniqueId`，不要在其他接口重新写一套聚合逻辑。

## 十、错误处理

Next helper 行为：

- `fetchEntryIdentityByUniqueId(uniqueId)` 找不到时返回 `null`。
- 详情页收到 `null` 后会触发 `notFound()`。
- 批量接口只返回存在的词条，不存在的 ID 不会生成空对象。

调用方建议：

```ts
const entry = await fetchEntryIdentityByUniqueId(entryId);

if (!entry) {
  return notFound();
}
```

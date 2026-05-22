# 语料采集小程序接口

## 概述

本文档描述**语料采集小程序**用户端接口。小程序前端页面由独立团队开发，平台后端提供 `/api/miniprogram/corpus_collection/*` 接口。

> 通用基础接口（认证、用户信息、上传、错误处理等）请参见: [`../../api-reference.md`](../../api-reference.md)
> 认证流程与中间件说明请参见: [`../../authentication.md`](../../authentication.md)
> 业务流程、审核规则和数据模型请参见: [`./business-logic.md`](./business-logic.md)

### 基础信息

- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: JWT Bearer Token
- **生产环境**: `https://search.aidimsum.com/api`
- **URL 前缀**: `/api/miniprogram/corpus_collection`

---

## 一、首页接口

### 1.1 获取首页数据

聚合返回当前活动、快捷入口、最新审核通过投稿和精选内容。

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/home`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求示例

```javascript
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/corpus_collection/home',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 成功响应 (200)

```json
{
  "banners": [
    {
      "id": "act_001",
      "title": "粤语诗歌朗诵赛",
      "imageUrl": "https://oss/banner.jpg",
      "linkType": "activity",
      "linkId": "act_001"
    }
  ],
  "quickEntries": [
    { "key": "submit", "title": "我要投稿" },
    { "key": "activities", "title": "活动日历" },
    { "key": "featured", "title": "精选内容" }
  ],
  "latestSubmissions": [
    {
      "id": "sub_001",
      "imageUrl": "https://oss/1.jpg",
      "author": "用户昵称",
      "avatar": "https://wx.qlogo.cn/...",
      "viewCount": 123,
      "isFeatured": false
    }
  ],
  "featuredSubmissions": []
}
```

`latestSubmissions` 为首页轻量卡片结构；作品详情请通过 `id` 调用投稿详情接口。

#### 错误响应

**401 Unauthorized**

```json
{
  "error": "Invalid or expired token"
}
```

### 1.2 获取首页投稿流

首页投稿流用于小红书式瀑布流/无限滚动展示。该接口只返回已审核通过且公开的投稿，和 `GET /home` 分离，前端首屏可先调用 `/home` 获取 Banner、活动和快捷入口，再按页调用本接口加载投稿卡片。

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/home/submissions`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `page` | number | 否 | `1` | 页码，从 1 开始 |
| `pageSize` | number | 否 | `20` | 每页数量，最大 30 |
| `sort` | string | 否 | `latest` | `latest` 最新、`likes` 点赞量、`views` 浏览量 |
| `type` / `submissionType` | string | 否 | - | 投稿类型 |
| `tag` | string | 否 | - | 分类标签 |
| `activityId` | string | 否 | - | 活动 ID |
| `isFeatured` | boolean | 否 | - | 是否只看精选 |
| `showOnHome` | boolean | 否 | - | 是否只看后台标记为首页展示的投稿 |

默认不强制 `showOnHome=true`，避免首页流内容不足；如果产品需要完全由后台运营控制首页流，前端传 `showOnHome=true`。

#### 请求示例

```javascript
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/corpus_collection/home/submissions?page=1&pageSize=20&sort=latest',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 成功响应 (200)

```json
{
  "items": [
    {
      "id": "sub_001",
      "title": "月光光",
      "intro": "粤语童谣朗诵",
      "submissionType": "诗歌",
      "tags": ["童谣"],
      "coverUrl": "https://oss/1.jpg",
      "imageUrls": ["https://oss/1.jpg"],
      "coverWidth": 1080,
      "coverHeight": 1440,
      "coverAspectRatio": 0.75,
      "author": {
        "id": "user_001",
        "name": "用户昵称",
        "avatar": "https://wx.qlogo.cn/..."
      },
      "activity": {
        "id": "act_001",
        "title": "粤语诗歌朗诵赛"
      },
      "likeCount": 20,
      "commentCount": 3,
      "shareCount": 5,
      "viewCount": 123,
      "isFeatured": true,
      "showOnHome": false,
      "liked": false,
      "createdAt": "2026-05-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 120,
    "hasMore": true
  }
}
```

字段说明：

| 字段 | 说明 |
|------|------|
| `coverUrl` | 瀑布流卡片主图，优先取第一张图片 |
| `coverWidth` / `coverHeight` | 上传媒体元数据中存在宽高时返回，否则为 `null` |
| `coverAspectRatio` | `coverWidth / coverHeight`，前端可用于预占瀑布流高度 |
| `liked` | 当前登录用户是否已点赞 |
| `hasMore` | 是否还有下一页，适合 `onReachBottom` 或虚拟列表继续加载 |

#### 错误响应

**401 Unauthorized**

```json
{
  "error": "Invalid or expired token"
}
```

---

## 二、活动接口

### 2.1 获取活动列表

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/activities`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `status` | string | 否 | `published` | 活动状态 |
| `keyword` / `q` | string | 否 | - | 活动标题、介绍模糊搜索关键词 |
| `includeExpired` | boolean | 否 | `false` | 是否包含已过期活动；默认仅返回未过期活动 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `10` | 每页数量 |

排序规则：默认返回未过期活动，按活动热度和时间倒序；当 `includeExpired=true` 时，过期活动排在未过期活动之后。

#### 成功响应 (200)

```json
{
  "items": [
    {
      "id": "act_001",
      "title": "粤语诗歌朗诵赛",
      "description": "征集粤语诗歌朗诵作品",
      "bannerUrl": "https://oss/banner.jpg",
      "status": "published",
      "startsAt": "2026-05-01T00:00:00.000Z",
      "endsAt": "2026-05-31T23:59:59.000Z",
      "submissionCount": 120,
      "works": [
        {
          "id": "sub_001",
          "title": "月光光",
          "intro": "粤语童谣朗诵",
          "submissionType": "诗歌",
          "tags": ["童谣"],
          "coverUrl": "https://oss/1.jpg",
          "imageUrls": ["https://oss/1.jpg"],
          "author": {
            "id": "user_001",
            "name": "用户昵称",
            "avatar": "https://wx.qlogo.cn/..."
          },
          "media": [
            { "type": "image", "url": "https://oss/1.jpg" },
            { "type": "audio", "url": "https://oss/a.mp3", "durationSec": 58 }
          ],
          "likeCount": 20,
          "commentCount": 3,
          "shareCount": 5,
          "viewCount": 123,
          "isFeatured": true,
          "isAwarded": false,
          "awardStatus": "none",
          "createdAt": "2026-05-01T10:00:00.000Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

### 2.2 获取活动详情

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/activities/{id}`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 成功响应 (200)

```json
{
  "id": "act_001",
  "title": "粤语诗歌朗诵赛",
  "description": "征集粤语诗歌朗诵作品",
  "rules": "上传 1 分钟以内朗诵音频",
  "status": "published",
  "timeStatus": "ongoing",
  "startsAt": "2026-05-01T00:00:00.000Z",
  "endsAt": "2026-05-31T23:59:59.000Z",
  "category": "诗歌朗诵",
  "tags": ["粤语", "童谣", "荔湾"],
  "submissionTypes": ["诗歌"],
  "rewardConfig": {
    "enabled": true,
    "description": "优秀作品可获得纪念奖品"
  },
  "mediaRequirements": {
    "images": { "required": true, "min": 1, "max": 9 },
    "audio": { "required": true, "maxDurationSec": 60 },
    "video": { "required": false, "maxDurationSec": 30 }
  },
  "bannerUrl": "https://oss/banner.jpg",
  "canSubmit": true,
  "canShare": true
}
```

`timeStatus` 由后端根据当前时间和活动时间计算，可选值：`not_started`、`ongoing`、`ended`。`canSubmit` 由后端根据活动状态、开始结束时间和当前用户权限计算。

#### 错误响应

**404 Not Found**

```json
{
  "error": "Activity not found"
}
```

### 2.3 获取活动作品列表

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/activities/{id}/works`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `submissionType` | string | 否 | - | 投稿类型 |
| `tag` | string | 否 | - | 分类标签 |
| `isFeatured` | boolean | 否 | - | 是否精选 |
| `awardStatus` | string | 否 | - | 中奖或奖励状态 |
| `sort` | string | 否 | `latest` | `latest` 最新、`likes` 点赞量 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `10` | 每页数量 |

#### 成功响应 (200)

```json
{
  "items": [
    {
      "id": "sub_001",
      "title": "月光光",
      "intro": "粤语童谣朗诵",
      "author": {
        "id": "user_001",
        "name": "用户昵称",
        "avatar": "https://wx.qlogo.cn/..."
      },
      "media": [
        { "type": "image", "url": "https://oss/1.jpg" },
        { "type": "audio", "url": "https://oss/a.mp3", "durationSec": 58 }
      ],
      "coverUrl": "https://oss/1.jpg",
      "imageUrls": ["https://oss/1.jpg"],
      "likeCount": 20,
      "commentCount": 3,
      "shareCount": 5,
      "viewCount": 123,
      "isFeatured": true,
      "isAwarded": false,
      "awardStatus": "none",
      "createdAt": "2026-05-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

---

## 三、投稿接口

### 3.1 投稿前安全检查

用户正式提交前调用，平台会转调 AI agent `POST /precheck/submissions`。该检查只检查文本和图片。

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/submissions/precheck`
- **方法**: `POST`
- **认证**: 需要 Bearer Token

#### 请求参数

```json
{
  "title": "月光光",
  "intro": "粤语童谣经典作品",
  "images": ["https://oss/1.jpg"]
}
```

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `title` | string | 是 | 投稿标题 |
| `intro` | string | 是 | 投稿介绍 |
| `images` | string[] | 是 | 图片 URL，最少 1 张，最多 9 张 |

#### 成功响应 (200)

```json
{
  "verdict": "pass",
  "details": {
    "text": { "verdict": "pass", "riskLevel": "none", "labels": [] },
    "images": [
      { "index": 0, "verdict": "pass", "riskLevel": "none", "labels": [] }
    ]
  }
}
```

#### 错误响应

**400 Bad Request**

```json
{
  "error": "invalid_payload"
}
```

**400 Bad Request**

```json
{
  "error": "invalid_media_url"
}
```

### 3.2 创建投稿

创建投稿并进入审核队列。建议前端先调用安全检查，通过后再创建投稿。

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/submissions`
- **方法**: `POST`
- **认证**: 需要 Bearer Token

#### 请求参数

```json
{
  "activityId": "act_001",
  "submissionType": "诗歌",
  "title": "月光光",
  "intro": "粤语童谣经典作品",
  "tags": ["童谣", "荔湾"],
  "media": [
    { "type": "image", "url": "https://oss/1.jpg", "sortOrder": 0 },
    { "type": "audio", "url": "https://oss/a.mp3", "durationSec": 58 }
  ],
  "precheckResult": {
    "verdict": "pass"
  }
}
```

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `activityId` | string | 否 | 关联活动 ID |
| `submissionType` | string | 是 | 用语/诗歌/故事/标语/地名解说/歇后语 |
| `title` | string | 是 | 标题 |
| `intro` | string | 是 | 介绍内容 |
| `tags` | string[] | 是 | 分类标签 |
| `media` | array | 是 | 多媒体列表，至少 1 张图片和 1 条音频 |
| `precheckResult` | object | 否 | 投稿前安全检查结果 |

#### 成功响应 (201)

```json
{
  "id": "sub_001",
  "reviewStatus": "pending_review",
  "message": "投稿已提交，等待审核"
}
```

#### 错误响应

**400 Bad Request** - 参数错误

```json
{
  "error": "Missing required fields"
}
```

**422 Unprocessable Entity** - 媒体不符合要求

```json
{
  "error": "Invalid media requirements"
}
```

### 3.3 获取我的投稿

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/submissions/mine`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `reviewStatus` | string | 否 | - | 审核状态，仅包含 `draft`、`pending_review`、`ai_reviewing`、`review_needed`、`approved`、`rejected` |
| `awardStatus` | string | 否 | - | 中奖或奖励状态，不包含在 `reviewStatus` 中 |
| `activityId` | string | 否 | - | 活动 ID |
| `withoutActivity` | boolean | 否 | `false` | 是否只返回未关联活动的投稿。传 `true` 时查询 `activity_id` 为空的数据；若同时传入有效 `activityId`，优先按 `activityId` 筛选 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `10` | 每页数量 |

未关联活动投稿示例：

```text
GET /api/miniprogram/corpus_collection/submissions/mine?withoutActivity=true
```

#### 成功响应 (200)

```json
{
  "items": [
    {
      "id": "sub_001",
      "title": "月光光",
      "intro": "粤语童谣经典作品",
      "submissionType": "诗歌",
      "tags": ["童谣", "荔湾"],
      "reviewStatus": "pending_review",
      "reviewReason": null,
      "coverUrl": "https://oss/1.jpg",
      "imageUrls": ["https://oss/1.jpg"],
      "media": [
        { "type": "image", "url": "https://oss/1.jpg" },
        { "type": "audio", "url": "https://oss/a.mp3", "durationSec": 58 }
      ],
      "isFeatured": true,
      "showOnHome": false,
      "isAwarded": false,
      "awardStatus": "none",
      "activity": {
        "id": "act_001",
        "title": "粤语诗歌朗诵赛"
      },
      "canEdit": true,
      "editableUntil": "2026-05-02T10:00:00.000Z",
      "createdAt": "2026-05-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

### 3.4 获取投稿详情

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/submissions/{id}`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

作者本人可以查看自己的全部投稿状态；非作者只能查看 `reviewStatus = approved` 且 `visibility = public` 的投稿。

#### 成功响应 (200)

```json
{
  "id": "sub_001",
  "title": "月光光",
  "intro": "粤语童谣经典作品",
  "submissionType": "诗歌",
  "tags": ["童谣", "荔湾"],
  "reviewStatus": "approved",
  "reviewReason": null,
  "author": {
    "id": "user_001",
    "name": "用户昵称",
    "avatar": "https://wx.qlogo.cn/..."
  },
  "activity": {
    "id": "act_001",
    "title": "粤语诗歌朗诵赛",
    "startsAt": "2026-05-01T00:00:00.000Z",
    "endsAt": "2026-05-31T23:59:59.000Z"
  },
  "media": [
    { "type": "image", "url": "https://oss/1.jpg" },
    { "type": "audio", "url": "https://oss/a.mp3", "durationSec": 58 }
  ],
  "likeCount": 20,
  "commentCount": 3,
  "shareCount": 5,
  "viewCount": 123,
  "coverUrl": "https://oss/1.jpg",
  "imageUrls": ["https://oss/1.jpg"],
  "isFeatured": true,
  "isAwarded": false,
  "awardStatus": "none",
  "canEdit": false,
  "editableUntil": null,
  "createdAt": "2026-05-01T10:00:00.000Z"
}
```

### 3.5 编辑投稿

活动投稿在活动截止前可由作者编辑，截止后不可编辑。普通投稿在创建后 24 小时内可由作者编辑，超过 24 小时不可编辑。投稿不开放删除。

编辑成功后投稿重新进入审核，建议后端设置：

```text
reviewStatus = pending_review
visibility = private
```

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/submissions/{id}`
- **方法**: `PATCH`
- **认证**: 需要 Bearer Token

#### 请求参数

```json
{
  "submissionType": "诗歌",
  "title": "月光光",
  "intro": "粤语童谣经典作品修改版",
  "tags": ["童谣", "荔湾"],
  "media": [
    { "type": "image", "url": "https://oss/1.jpg", "sortOrder": 0 },
    { "type": "audio", "url": "https://oss/a.mp3", "durationSec": 58 }
  ],
  "precheckResult": {
    "verdict": "pass"
  }
}
```

#### 成功响应 (200)

```json
{
  "id": "sub_001",
  "reviewStatus": "pending_review",
  "canEdit": true,
  "editableUntil": "2026-05-02T10:00:00.000Z",
  "message": "修改已提交，等待审核"
}
```

#### 错误响应

**403 Forbidden** - 不允许编辑

```json
{
  "error": "submission_edit_not_allowed"
}
```

**405 Method Not Allowed** - 不允许删除投稿

```json
{
  "error": "submission_delete_not_allowed"
}
```

---

## 四、精选内容接口

### 4.1 获取精选投稿

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/featured`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `type` | string | 否 | - | 投稿类型 |
| `tag` | string | 否 | - | 标签 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `10` | 每页数量 |

#### 成功响应 (200)

```json
{
  "items": [
    {
      "id": "sub_001",
      "title": "月光光",
      "intro": "粤语童谣经典作品",
      "submissionType": "诗歌",
      "tags": ["童谣", "荔湾"],
      "coverUrl": "https://oss/1.jpg",
      "imageUrls": ["https://oss/1.jpg"],
      "author": {
        "id": "user_001",
        "name": "用户昵称",
        "avatar": "https://wx.qlogo.cn/..."
      },
      "likeCount": 20,
      "commentCount": 3,
      "shareCount": 5,
      "viewCount": 123,
      "isFeatured": true,
      "showOnHome": true,
      "isAwarded": false,
      "awardStatus": "none",
      "createdAt": "2026-05-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

---

## 五、互动接口

### 5.1 点赞或取消点赞

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/works/{id}/like`
- **方法**: `POST`
- **认证**: 需要 Bearer Token

#### 请求参数

```json
{
  "liked": true
}
```

#### 成功响应 (200)

```json
{
  "liked": true,
  "likeCount": 21
}
```

### 5.2 新增浏览数

作品详情页曝光或进入详情时调用。后端会校验作品是否对当前用户可见，然后将浏览数加 1。

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/works/{id}/view`
- **方法**: `POST`
- **认证**: 需要 Bearer Token

#### 成功响应 (200)

```json
{
  "id": "sub_001",
  "viewCount": 124
}
```

### 5.3 新增分享数

用户分享作品时调用。后端会校验作品是否对当前用户可见，然后将分享数加 1。

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/works/{id}/share`
- **方法**: `POST`
- **认证**: 需要 Bearer Token

#### 成功响应 (200)

```json
{
  "id": "sub_001",
  "shareCount": 6
}
```

### 5.4 获取评论列表

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/works/{id}/comments`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 成功响应 (200)

```json
{
  "items": [
    {
      "id": "comment_001",
      "content": "很有荔湾味道",
      "author": {
        "id": "user_001",
        "name": "用户昵称",
        "avatar": "https://wx.qlogo.cn/..."
      },
      "createdAt": "2026-05-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

### 5.5 发表评论

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/works/{id}/comments`
- **方法**: `POST`
- **认证**: 需要 Bearer Token

#### 请求参数

```json
{
  "content": "很有荔湾味道"
}
```

#### 成功响应 (201)

```json
{
  "id": "comment_001",
  "status": "pending_review",
  "message": "评论已提交，等待审核"
}
```

---

## 六、消息接口

### 6.1 获取消息列表

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/message`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `unreadOnly` | boolean | 否 | `false` | 是否只返回未读消息 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `20` | 每页数量 |

#### 成功响应 (200)

```json
{
  "items": [
    {
      "id": "msg_001",
      "date": "2026-05-17",
      "content": "你的作品「月光光」未通过审核：图片不清晰",
      "title": "审核未通过",
      "type": "审核信息",
      "isRead": false,
      "workId": "sub_001"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

消息类型建议使用：`系统提示`、`活动通知`、`中奖信息`、`审核信息`。当消息关联作品时返回 `workId`。接口命名建议后续统一为 `/messages`，兼容期可保留 `/message`。

### 6.2 标记单条消息已读

用户点击未读消息后调用，将该消息标记为已读。

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/messages/{id}/read`
- **方法**: `PATCH`
- **认证**: 需要 Bearer Token

#### 成功响应 (200)

```json
{
  "id": "msg_001",
  "isRead": true,
  "unreadNotificationCount": 0
}
```

### 6.3 标记全部消息已读

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/messages/read-all`
- **方法**: `PATCH`
- **认证**: 需要 Bearer Token

#### 成功响应 (200)

```json
{
  "updatedCount": 3,
  "unreadNotificationCount": 0
}
```

## 七、个人中心接口

### 7.1 获取个人中心概要

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/profile/summary`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 成功响应 (200)

```json
{
  "submissionCount": 12,
  "approvedCount": 8,
  "pendingCount": 3,
  "rejectedCount": 1,
  "activityCount": 2,
  "points": 120,
  "unreadNotificationCount": 1
}
```

### 7.2 获取我的活动

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/profile/activities`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 成功响应 (200)

```json
{
  "items": [
    {
      "id": "act_001",
      "title": "粤语诗歌朗诵赛",
      "submissionCount": 2,
      "approvedCount": 1,
      "awardStatus": "none"
    }
  ]
}
```

---

## 八、通用错误

**401 Unauthorized** - Token 缺失、无效或过期

```json
{
  "error": "Invalid or expired token"
}
```

**403 Forbidden** - 权限不足

```json
{
  "error": "Insufficient permissions"
}
```

**404 Not Found** - 资源不存在

```json
{
  "error": "Resource not found"
}
```

**500 Internal Server Error** - 服务端错误

```json
{
  "error": "Internal server error"
}
```

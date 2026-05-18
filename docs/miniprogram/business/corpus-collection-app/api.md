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
      "views": "123"
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
          "views": "123",
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
  "canShare": true
}
```

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
      "views": "123",
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
| `reviewStatus` | string | 否 | - | 审核状态 |
| `activityId` | string | 否 | - | 活动 ID |
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
      "reviewStatus": "pending_review",
      "reviewReason": null,
      "coverUrl": "https://oss/1.jpg",
      "imageUrls": ["https://oss/1.jpg"],
      "media": [
        { "type": "image", "url": "https://oss/1.jpg" },
        { "type": "audio", "url": "https://oss/a.mp3", "durationSec": 58 }
      ],
      "isAwarded": false,
      "awardStatus": "none",
      "activity": {
        "id": "act_001",
        "title": "粤语诗歌朗诵赛"
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

### 3.4 获取投稿详情

#### 接口信息

- **URL**: `/api/miniprogram/corpus_collection/submissions/{id}`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 成功响应 (200)

```json
{
  "id": "sub_001",
  "title": "月光光",
  "intro": "粤语童谣经典作品",
  "submissionType": "诗歌",
  "tags": ["童谣", "荔湾"],
  "reviewStatus": "approved",
  "media": [
    { "type": "image", "url": "https://oss/1.jpg" },
    { "type": "audio", "url": "https://oss/a.mp3", "durationSec": 58 }
  ],
  "likeCount": 20,
  "commentCount": 3,
  "shareCount": 5,
  "viewCount": 123,
  "views": "123",
  "coverUrl": "https://oss/1.jpg",
  "imageUrls": ["https://oss/1.jpg"],
  "isAwarded": false,
  "awardStatus": "none",
  "createdAt": "2026-05-01T10:00:00.000Z"
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
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0
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
  "viewCount": 124,
  "views": "124"
}
```

### 5.3 获取评论列表

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

### 5.4 发表评论

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

消息类型建议使用：`系统提示`、`活动通知`、`中奖信息`、`审核信息`。当消息关联作品时返回 `workId`。

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

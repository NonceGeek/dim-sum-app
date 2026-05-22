# 语料采集小程序接口补充实施结果

本文档记录小程序端开发反馈后的已实施接口契约和代码落地结果。对应主接口文档已同步更新：[`./api.md`](./api.md)；业务规则已同步更新：[`./business-logic.md`](./business-logic.md)。

## 一、字段与状态已统一

### 1.1 浏览数字段

已统一使用：

```json
{
  "viewCount": 123
}
```

小程序端接口响应中已移除字符串格式的 `views: "123"`。作品详情、作品卡片、首页轻量卡片和浏览数接口均返回 number 类型 `viewCount`。

已实施位置：

```text
main/lib/services/corpus-collection.ts
main/app/api/miniprogram/corpus_collection/works/{id}/view/route.ts
```

### 1.2 审核状态、中奖状态、精选状态已分离

`reviewStatus` 只表示审核状态，不包含中奖状态：

```text
draft
pending_review
ai_reviewing
review_needed
approved
rejected
```

`awardStatus` 表示中奖或奖励状态：

```text
none
candidate
awarded
not_awarded
claimed
expired
```

当前数据库和接口已支持独立字段：

```json
{
  "reviewStatus": "approved",
  "awardStatus": "none",
  "isFeatured": true,
  "showOnHome": false
}
```

所有作品卡片和作品详情已返回 `isFeatured`。首页展示相关响应已返回 `showOnHome`。

已实施位置：

```text
main/lib/services/corpus-collection.ts
main/app/api/miniprogram/corpus_collection/home/route.ts
main/app/api/miniprogram/corpus_collection/featured/route.ts
main/app/api/miniprogram/corpus_collection/activities/{id}/works/route.ts
main/app/api/miniprogram/corpus_collection/submissions/mine/route.ts
main/app/api/miniprogram/corpus_collection/submissions/{id}/route.ts
```

## 二、消息已读接口已实施

保留原消息列表接口：

```text
GET /api/miniprogram/corpus_collection/message
```

新增复数命名兼容入口：

```text
GET /api/miniprogram/corpus_collection/messages
```

新增单条消息已读接口：

```text
PATCH /api/miniprogram/corpus_collection/messages/{id}/read
```

响应：

```json
{
  "id": "msg_001",
  "isRead": true,
  "unreadNotificationCount": 0
}
```

新增全部消息已读接口：

```text
PATCH /api/miniprogram/corpus_collection/messages/read-all
```

响应：

```json
{
  "updatedCount": 3,
  "unreadNotificationCount": 0
}
```

已实施位置：

```text
main/app/api/miniprogram/corpus_collection/messages/route.ts
main/app/api/miniprogram/corpus_collection/messages/{id}/read/route.ts
main/app/api/miniprogram/corpus_collection/messages/read-all/route.ts
```

## 三、我的投稿筛选已实施

接口：

```text
GET /api/miniprogram/corpus_collection/submissions/mine
```

已支持 `awardStatus` 独立筛选：

```text
GET /api/miniprogram/corpus_collection/submissions/mine?reviewStatus=approved&awardStatus=awarded
```

已支持参数：

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `reviewStatus` | string | 否 | 审核状态 |
| `awardStatus` | string | 否 | 中奖或奖励状态 |
| `activityId` | string | 否 | 活动 ID |
| `withoutActivity` | boolean | 否 | 是否只返回未关联活动的投稿 |
| `page` | number | 否 | 页码 |
| `pageSize` | number | 否 | 每页数量 |

列表项已返回：

```json
{
  "isFeatured": true,
  "showOnHome": false,
  "canEdit": true,
  "editableUntil": "2026-05-02T10:00:00.000Z"
}
```

已实施位置：

```text
main/app/api/miniprogram/corpus_collection/submissions/mine/route.ts
main/lib/services/corpus-collection.ts
```

## 四、活动详情字段已补齐

接口：

```text
GET /api/miniprogram/corpus_collection/activities/{id}
```

活动详情已返回：

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
  "bannerUrl": "https://oss/banner.jpg",
  "canSubmit": true,
  "canShare": true
}
```

`timeStatus` 由后端计算：

```text
not_started
ongoing
ended
```

`canSubmit` 由后端根据活动状态、开始结束时间计算。

数据库已补充活动字段：

```text
category
tags
submission_types
```

已实施位置：

```text
main/lib/services/corpus-collection.ts
main/prisma/schema.prisma
main/prisma/migrations/20260520090000_extend_corpus_collection_contract/migration.sql
main/app/api/admin/corpus-collection/activities/route.ts
main/app/api/admin/corpus-collection/activities/{id}/route.ts
```

## 五、活动作品筛选已实施

接口：

```text
GET /api/miniprogram/corpus_collection/activities/{id}/works
```

已支持筛选参数：

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `submissionType` | string | 否 | 投稿类型 |
| `tag` | string | 否 | 分类标签 |
| `isFeatured` | boolean | 否 | 是否精选 |
| `awardStatus` | string | 否 | 中奖或奖励状态 |
| `sort` | string | 否 | `latest` 最新、`likes` 点赞量 |
| `page` | number | 否 | 页码 |
| `pageSize` | number | 否 | 每页数量 |

示例：

```text
GET /api/miniprogram/corpus_collection/activities/act_001/works?submissionType=诗歌&tag=童谣&isFeatured=true&sort=likes
```

作品卡片已返回：

```json
{
  "id": "sub_001",
  "title": "月光光",
  "submissionType": "诗歌",
  "tags": ["童谣"],
  "viewCount": 123,
  "isFeatured": true,
  "showOnHome": false,
  "isAwarded": false,
  "awardStatus": "none"
}
```

已实施位置：

```text
main/app/api/miniprogram/corpus_collection/activities/{id}/works/route.ts
main/lib/services/corpus-collection.ts
```

## 六、投稿详情权限与字段已实施

接口：

```text
GET /api/miniprogram/corpus_collection/submissions/{id}
```

已实施权限规则：

```text
作者本人：可以查看自己的全部投稿状态，包括 pending_review、rejected、approved。
非作者：只能查看 reviewStatus = approved 且 visibility = public 的投稿。
```

响应已补齐作者、活动、精选和编辑能力：

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
  "media": [],
  "likeCount": 20,
  "commentCount": 3,
  "shareCount": 5,
  "viewCount": 123,
  "isFeatured": true,
  "showOnHome": false,
  "isAwarded": false,
  "awardStatus": "none",
  "canEdit": false,
  "editableUntil": null,
  "createdAt": "2026-05-01T10:00:00.000Z"
}
```

已实施位置：

```text
main/app/api/miniprogram/corpus_collection/submissions/{id}/route.ts
main/lib/services/corpus-collection.ts
```

## 七、投稿编辑与不可删除已实施

新增编辑接口：

```text
PATCH /api/miniprogram/corpus_collection/submissions/{id}
```

活动投稿编辑条件已实施：

```text
当前用户必须是作者
活动未截止
投稿未中奖
投稿未被后台锁定
截止日期前可编辑
截止日期后不可编辑
不能删除
```

普通投稿编辑条件已实施：

```text
当前用户必须是作者
创建后 24 小时内可编辑
超过 24 小时不可编辑
不能删除
```

编辑成功后已重新进入审核：

```text
reviewStatus = pending_review
visibility = private
```

响应：

```json
{
  "id": "sub_001",
  "reviewStatus": "pending_review",
  "canEdit": true,
  "editableUntil": "2026-05-02T10:00:00.000Z",
  "message": "修改已提交，等待审核"
}
```

小程序端删除投稿不开放。误调：

```text
DELETE /api/miniprogram/corpus_collection/submissions/{id}
```

已返回：

```json
{
  "error": "submission_delete_not_allowed"
}
```

已实施位置：

```text
main/app/api/miniprogram/corpus_collection/submissions/{id}/route.ts
main/lib/services/corpus-collection.ts
main/prisma/schema.prisma
main/prisma/migrations/20260520090000_extend_corpus_collection_contract/migration.sql
```

## 八、首页投稿流分页接口已实施

新增小红书式首页投稿瀑布流接口：

```text
GET /api/miniprogram/corpus_collection/home/submissions
```

用途：

```text
GET /home
  -> 获取 Banner、活动、快捷入口和首屏聚合信息

GET /home/submissions?page=1&pageSize=20
  -> 分页获取首页投稿卡片，用于无限滚动
```

已支持参数：

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `20` | 每页数量，最大 30 |
| `sort` | string | 否 | `latest` | `latest`、`likes`、`views` |
| `type` / `submissionType` | string | 否 | - | 投稿类型 |
| `tag` | string | 否 | - | 分类标签 |
| `activityId` | string | 否 | - | 活动 ID |
| `isFeatured` | boolean | 否 | - | 是否只看精选 |
| `showOnHome` | boolean | 否 | - | 是否只看后台标记首页展示的投稿 |

响应卡片已包含瀑布流所需字段：

```json
{
  "coverUrl": "https://oss/1.jpg",
  "coverWidth": 1080,
  "coverHeight": 1440,
  "coverAspectRatio": 0.75,
  "liked": false,
  "pagination": {
    "hasMore": true
  }
}
```

已实施位置：

```text
main/app/api/miniprogram/corpus_collection/home/submissions/route.ts
main/lib/services/corpus-collection.ts
```

## 九、已实施接口清单

```text
GET    /api/miniprogram/corpus_collection/home
GET    /api/miniprogram/corpus_collection/home/submissions
GET    /api/miniprogram/corpus_collection/activities/{id}
GET    /api/miniprogram/corpus_collection/activities/{id}/works
GET    /api/miniprogram/corpus_collection/submissions/mine
GET    /api/miniprogram/corpus_collection/submissions/{id}
PATCH  /api/miniprogram/corpus_collection/submissions/{id}
DELETE /api/miniprogram/corpus_collection/submissions/{id}
GET    /api/miniprogram/corpus_collection/featured
GET    /api/miniprogram/corpus_collection/messages
PATCH  /api/miniprogram/corpus_collection/messages/{id}/read
PATCH  /api/miniprogram/corpus_collection/messages/read-all
```

## 十、验证结果

已执行并通过：

```bash
pnpm exec prisma generate
pnpm exec tsc --noEmit
```

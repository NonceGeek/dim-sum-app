# 语料采集小程序接口变更说明


## 一、浏览数字段调整

原问题：

```text
views: string
```

已调整为统一使用 number 类型：

```json
{
  "viewCount": 123
}
```

小程序端后续不要再依赖字符串类型的 `views` 字段。展示格式如 `1.2k`、`1.3万` 建议由前端自行格式化。

涉及接口：

```text
GET  /api/miniprogram/corpus_collection/home
GET  /api/miniprogram/corpus_collection/featured
GET  /api/miniprogram/corpus_collection/activities/{id}/works
GET  /api/miniprogram/corpus_collection/submissions/mine
GET  /api/miniprogram/corpus_collection/submissions/{id}
POST /api/miniprogram/corpus_collection/works/{id}/view
```

## 二、消息未读变已读

原问题：

```text
缺 message 点击未读变已读接口
```

已新增单条消息已读接口：

```text
PATCH /api/miniprogram/corpus_collection/messages/{id}/read
```

成功响应：

```json
{
  "id": "msg_001",
  "isRead": true,
  "unreadNotificationCount": 0
}
```

已新增全部消息已读接口：

```text
PATCH /api/miniprogram/corpus_collection/messages/read-all
```

成功响应：

```json
{
  "updatedCount": 3,
  "unreadNotificationCount": 0
}
```

消息列表原接口继续可用：

```text
GET /api/miniprogram/corpus_collection/message
```

同时新增复数命名入口：

```text
GET /api/miniprogram/corpus_collection/messages
```

小程序端可以优先使用 `/messages`。

## 三、我的投稿筛选

原问题：

```text
/submissions/mine 参数 reviewStatus 是否包含中奖状态
```

结论：

```text
reviewStatus 不包含中奖状态。
中奖状态使用 awardStatus 单独筛选。
```

我的投稿接口：

```text
GET /api/miniprogram/corpus_collection/submissions/mine
```

已支持参数：

| 参数名 | 类型 | 说明 |
|-------|------|------|
| `reviewStatus` | string | 审核状态 |
| `awardStatus` | string | 中奖或奖励状态 |
| `activityId` | string | 活动 ID |
| `page` | number | 页码 |
| `pageSize` | number | 每页数量 |

示例：

```text
GET /api/miniprogram/corpus_collection/submissions/mine?reviewStatus=approved&awardStatus=awarded
```

`reviewStatus` 可用值：

```text
draft
pending_review
ai_reviewing
review_needed
approved
rejected
```

`awardStatus` 可用值：

```text
none
candidate
awarded
not_awarded
claimed
expired
```

## 四、活动详情字段补充

原问题：

```text
/activities/{id} 缺开始结束时间、分类标签
```

活动详情接口：

```text
GET /api/miniprogram/corpus_collection/activities/{id}
```

已补充字段：

```json
{
  "status": "published",
  "timeStatus": "ongoing",
  "startsAt": "2026-05-01T00:00:00.000Z",
  "endsAt": "2026-05-31T23:59:59.000Z",
  "category": "诗歌朗诵",
  "tags": ["粤语", "童谣", "荔湾"],
  "submissionTypes": ["诗歌"],
  "canSubmit": true
}
```

`timeStatus` 可用值：

```text
not_started
ongoing
ended
```

小程序端可直接使用：

```text
timeStatus 展示活动时间状态
canSubmit 控制是否展示或启用投稿入口
startsAt / endsAt 展示活动开始和结束时间
category / tags 展示活动分类和标签
submissionTypes 展示或限制活动允许投稿类型
```

## 五、活动作品列表筛选

原问题：

```text
/activities/{id}/works 根据投稿类型进行筛选
```

活动作品接口：

```text
GET /api/miniprogram/corpus_collection/activities/{id}/works
```

已支持参数：

| 参数名 | 类型 | 说明 |
|-------|------|------|
| `submissionType` | string | 投稿类型 |
| `tag` | string | 分类标签 |
| `isFeatured` | boolean | 是否精选 |
| `awardStatus` | string | 中奖或奖励状态 |
| `sort` | string | `latest` 最新、`likes` 点赞量 |
| `page` | number | 页码 |
| `pageSize` | number | 每页数量 |

示例：

```text
GET /api/miniprogram/corpus_collection/activities/act_001/works?submissionType=诗歌&tag=童谣&isFeatured=true&sort=likes
```

作品项会返回：

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

## 六、投稿详情查看权限与字段补充

原问题：

```text
/submissions/{id} 应该既可以看自己的，也可以看别人的。
缺作者，缺参加的活动。
```

投稿详情接口：

```text
GET /api/miniprogram/corpus_collection/submissions/{id}
```

权限规则：

```text
作者本人：可以查看自己的全部投稿状态，包括 pending_review、rejected、approved。
非作者：只能查看 reviewStatus = approved 且 visibility = public 的投稿。
```

已补充字段：

```json
{
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
  "isFeatured": true,
  "showOnHome": false,
  "canEdit": false,
  "editableUntil": null
}
```

小程序端可以使用：

```text
author 展示作者信息
activity 展示关联活动
canEdit 控制编辑按钮是否可用
editableUntil 展示可编辑截止时间
isFeatured 展示精选标识
```

## 七、投稿编辑与删除规则

原问题：

```text
只有创建投稿接口，没有编辑和删除接口。
活动投稿截止日期前能编辑，截止后不能编辑，不能删除。
普通投稿 24 小时内可修改，超过 24 小时不能修改，不能删除。
```

已新增编辑投稿接口：

```text
PATCH /api/miniprogram/corpus_collection/submissions/{id}
```

请求示例：

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

成功响应：

```json
{
  "id": "sub_001",
  "reviewStatus": "pending_review",
  "canEdit": true,
  "editableUntil": "2026-05-02T10:00:00.000Z",
  "message": "修改已提交，等待审核"
}
```

编辑规则：

```text
活动投稿：活动截止前可编辑，截止后不可编辑。
普通投稿：创建后 24 小时内可编辑，超过 24 小时不可编辑。
中奖投稿：不可编辑。
后台锁定投稿：不可编辑。
编辑成功后：重新进入审核，reviewStatus = pending_review。
```

删除规则：

```text
小程序端不允许删除投稿。
```

如果调用：

```text
DELETE /api/miniprogram/corpus_collection/submissions/{id}
```

会返回：

```json
{
  "error": "submission_delete_not_allowed"
}
```

## 八、精选作品标识

原问题：

```text
精选作品展示需要一个参数告知前端这是精选。
```

已统一返回：

```json
{
  "isFeatured": true,
  "showOnHome": true
}
```

说明：

```text
isFeatured：是否精选，前端可用于展示精选角标。
showOnHome：是否首页展示，首页相关场景可使用。
```

涉及接口：

```text
GET /api/miniprogram/corpus_collection/home
GET /api/miniprogram/corpus_collection/featured
GET /api/miniprogram/corpus_collection/activities/{id}/works
GET /api/miniprogram/corpus_collection/submissions/mine
GET /api/miniprogram/corpus_collection/submissions/{id}
```

## 九、小程序端需要调整的点

1. 浏览数统一读取 `viewCount`，不要再读取字符串 `views`。
2. 消息点击后调用 `PATCH /messages/{id}/read`。
3. 一键已读调用 `PATCH /messages/read-all`。
4. 我的投稿中奖筛选使用 `awardStatus`，不要把中奖状态放进 `reviewStatus`。
5. 活动详情页使用 `startsAt`、`endsAt`、`timeStatus`、`category`、`tags`、`submissionTypes`、`canSubmit`。
6. 活动作品列表筛选投稿类型时传 `submissionType`。
7. 投稿详情页展示 `author` 和 `activity`。
8. 编辑按钮使用 `canEdit` 控制，编辑截止时间使用 `editableUntil`。
9. 投稿编辑使用 `PATCH /submissions/{id}`。
10. 不做投稿删除入口。
11. 精选角标使用 `isFeatured`。

## 十、首页投稿流分页接口

原需求：

```text
首页投稿需要小红书式流式展示，投稿列表要单独分页加载。
```

已新增接口：

```text
GET /api/miniprogram/corpus_collection/home/submissions
```

支持参数：

| 参数名 | 类型 | 说明 |
|-------|------|------|
| `page` | number | 页码，默认 1 |
| `pageSize` | number | 每页数量，默认 20，最大 30 |
| `sort` | string | `latest`、`likes`、`views` |
| `type` / `submissionType` | string | 投稿类型 |
| `tag` | string | 分类标签 |
| `activityId` | string | 活动 ID |
| `isFeatured` | boolean | 是否只看精选 |
| `showOnHome` | boolean | 是否只看后台标记首页展示的投稿 |

成功响应包含：

```json
{
  "items": [
    {
      "id": "sub_001",
      "title": "月光光",
      "coverUrl": "https://oss/1.jpg",
      "coverAspectRatio": 0.75,
      "author": {
        "id": "user_001",
        "name": "用户昵称",
        "avatar": "https://wx.qlogo.cn/..."
      },
      "likeCount": 20,
      "commentCount": 3,
      "viewCount": 123,
      "isFeatured": true,
      "showOnHome": false,
      "liked": false
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

小程序首页建议：

```text
首屏进入：GET /home 获取 Banner、活动、快捷入口
投稿瀑布流：GET /home/submissions?page=1&pageSize=20
继续加载：hasMore=true 时 page + 1
```

默认返回所有已通过且公开的投稿；如果产品需要只展示运营挑选内容，调用时传 `showOnHome=true`。

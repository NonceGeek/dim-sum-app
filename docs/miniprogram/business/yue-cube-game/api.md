# 粤方块小游戏接口

## 概述

本文档描述**粤方块小游戏**小程序业务接口。普通登录用户即可调用。

> 通用基础接口（认证、用户信息、上传、错误处理等）请参见: [`../../api-reference.md`](../../api-reference.md)
> 认证流程与中间件说明请参见: [`../../authentication.md`](../../authentication.md)
> 业务流程、数据写入和进度规则请参见: [`./business-logic.md`](./business-logic.md)

### 基础信息

- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: JWT Bearer Token
- **生产环境**: `https://search.aidimsum.com/api`

---

## 一、游戏接口

> 游戏接口使用普通小程序认证 (`requireMiniprogramAuth`)，只要用户已登录即可调用。
>
> **数据来源**:
> - 语境填空: 离线导入表 `game_cloze_questions`
> - 识字辨音: 语料库 `cantonese_corpus_all`，固定筛选 `category = yywj2`
> - 传图识音: 调用 AI 服务完成图片审核和图音联合评分

### 1.1 获取当日游戏进度

获取当前登录用户今日完成进度、连续打卡天数和今日完成题数。

#### 接口信息

- **URL**: `/api/miniprogram/yue_cube_game/today_progress`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/yue_cube_game/today_progress',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 成功响应 (200)

```json
{
  "today_progress": 0.4,
  "consecutive_days": 3,
  "completed_questions": 4
}
```

#### 错误响应

**401 Unauthorized** - Token 缺失、无效或过期

```json
{
  "error": "Invalid or expired token"
}
```

**500 Internal Server Error** - 查询失败

```json
{
  "error": "Failed to load today progress"
}
```

---

### 1.2 获取个人游戏数据

获取当前登录用户累计游戏数据。数据来自 `game_player_progress` 汇总快照表。

#### 接口信息

- **URL**: `/api/miniprogram/yue_cube_game/player_progress`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/yue_cube_game/player_progress',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 成功响应 (200)

```json
{
  "total_time": 360,
  "completed_questions": 24,
  "accuracy": 0.75,
  "level": "beginner"
}
```

#### 错误响应

**401 Unauthorized** - Token 缺失、无效或过期

```json
{
  "error": "Invalid or expired token"
}
```

**500 Internal Server Error** - 查询失败

```json
{
  "error": "Failed to load player progress"
}
```

---

### 1.3 获取题型场景列表

按题型获取可选场景列表。

#### 接口信息

- **URL**: `/api/miniprogram/yue_cube_game/question_scenes`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `mode` | string | 是 | 题型: `context` 语境填空、`sound` 识字辨音、`image` 传图识音 |

#### 请求示例

```javascript
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/yue_cube_game/question_scenes?mode=context',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 成功响应 (200)

```json
[
  {
    "id": "饮食",
    "scene": "饮食",
    "total": 10
  }
]
```

#### 错误响应

**400 Bad Request** - `mode` 参数非法

```json
{
  "error": "Invalid mode. Expected context, sound, or image."
}
```

**401 Unauthorized** - Token 缺失、无效或过期

```json
{
  "error": "Invalid or expired token"
}
```

**500 Internal Server Error** - 查询失败

```json
{
  "error": "Failed to load scenes"
}
```

---

### 1.4 获取语境填空题目

批量获取语境填空题目。题目来自 `game_cloze_questions` 表，仅返回 `status = active` 的题目。

#### 接口信息

- **URL**: `/api/miniprogram/yue_cube_game/question_context`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `scene_id` | string | 否 | - | 场景 ID，不传则从全部 active 题目随机抽取 |
| `limit` | number | 否 | `10` | 返回题目数，最大 `50` |

#### 请求示例

```javascript
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/yue_cube_game/question_context?scene_id=饮食&limit=10',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 成功响应 (200)

```json
[
  {
    "id": "1",
    "scene_id": "饮食",
    "question": [{ "role": "题目", "content": "我想要一份____" }],
    "stemPre": "我想要一份",
    "stemPost": "",
    "options": [
      { "text": "西多士", "pronunciation": "sai1 do1 si2", "jyutping": "sai1 do1 si2" }
    ],
    "answer": "西多士",
    "answerIndex": 0,
    "scenario": "饮食",
    "explanation": "西多士是经典茶餐厅食物"
  }
]
```

#### 错误响应

**401 Unauthorized** - Token 缺失、无效或过期

```json
{
  "error": "Invalid or expired token"
}
```

**500 Internal Server Error** - 查询失败

```json
{
  "error": "Failed to load context questions"
}
```

---

### 1.5 获取识字辨音题目

批量获取识字辨音题目。题目来自 `cantonese_corpus_all` 表，固定筛选 `category = yywj2`。

#### 接口信息

- **URL**: `/api/miniprogram/yue_cube_game/question_sound`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `limit` | number | 否 | `10` | 返回题目数，最大 `50` |

#### 请求示例

```javascript
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/yue_cube_game/question_sound?limit=10',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 成功响应 (200)

```json
[
  {
    "id": "b3a3c4f1-0000-0000-0000-000000000000",
    "scene_id": "yywj2",
    "question": "我想要一份西多士",
    "meaning": "我想要一份法兰西多士",
    "jyutping": "ngo5 soeng2 jiu3 jat1 fan6 sai1 do1 si2",
    "audio": "https://example.com/ref.mp3"
  }
]
```

#### 错误响应

**401 Unauthorized** - Token 缺失、无效或过期

```json
{
  "error": "Invalid or expired token"
}
```

**500 Internal Server Error** - 查询失败

```json
{
  "error": "Failed to load sound questions"
}
```

---

### 1.6 图片审核

传图识音上传图片后先调用本接口。审核不通过或图片不清晰时，前端应提示用户重新上传。

#### 接口信息

- **URL**: `/api/miniprogram/yue_cube_game/image_moderation`
- **方法**: `POST`
- **认证**: 需要 Bearer Token

#### 请求参数

```json
{
  "imageUrl": "https://platform-oss/example.jpg"
}
```

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `imageUrl` | string | 是 | 用户上传图片 URL |

#### 请求示例

```javascript
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/yue_cube_game/image_moderation',
  method: 'POST',
  header: {
    'Authorization': `Bearer ${accessToken}`
  },
  data: {
    imageUrl: 'https://platform-oss/example.jpg'
  }
});
```

#### 成功响应 (200)

```json
{
  "pass": true,
  "moderation": {
    "pass": true,
    "labels": []
  },
  "clarity": {
    "pass": true,
    "score": 88
  },
  "comment": ""
}
```

#### 错误响应

**400 Bad Request** - 缺少图片 URL

```json
{
  "error": "Missing required field: imageUrl"
}
```

**400 Bad Request** - 图片 URL 无法拉取

```json
{
  "error": "invalid_media_url"
}
```

**401 Unauthorized** - Token 缺失、无效或过期

```json
{
  "error": "Invalid or expired token"
}
```

**502 Bad Gateway** - AI 服务调用失败

```json
{
  "error": "upstream_failed"
}
```

---

### 1.7 传图识音联合评分

用户录音完成后调用本接口。本接口会调用 AI 服务从「录音是否有效」「是否粤语」「图音是否相关」三个维度评分，并写入答题记录与用户进度汇总。

#### 接口信息

- **URL**: `/api/miniprogram/yue_cube_game/picvoice_review`
- **方法**: `POST`
- **认证**: 需要 Bearer Token

#### 请求参数

```json
{
  "scene": "饮食",
  "imageUrl": "https://platform-oss/example.jpg",
  "audioUrl": "https://platform-oss/example.mp3",
  "time": 12
}
```

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `scene` | string | 是 | 场景名称 |
| `imageUrl` | string | 是 | 用户上传图片 URL |
| `audioUrl` | string | 是 | 用户录音 URL |
| `time` | number | 否 | 答题耗时，单位秒 |

#### 请求示例

```javascript
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/yue_cube_game/picvoice_review',
  method: 'POST',
  header: {
    'Authorization': `Bearer ${accessToken}`
  },
  data: {
    scene: '饮食',
    imageUrl: 'https://platform-oss/example.jpg',
    audioUrl: 'https://platform-oss/example.mp3',
    time: 12
  }
});
```

#### 成功响应 (200)

```json
{
  "overallPass": false,
  "dimensions": {
    "audioActive": { "pass": false, "reason": "有效语音占比不足 30%" },
    "isCantonese": { "pass": false, "confidence": 0.4, "reason": "更像普通话" },
    "imageAudioMatch": { "pass": true, "score": 78, "reason": "图音内容匹配" }
  },
  "comment": "录音里大部分是静音，请重新录制"
}
```

#### 错误响应

**400 Bad Request** - 缺少必填字段

```json
{
  "error": "Missing required fields: scene, imageUrl, audioUrl"
}
```

**400 Bad Request** - 媒体 URL 无法拉取

```json
{
  "error": "invalid_media_url"
}
```

**401 Unauthorized** - Token 缺失、无效或过期

```json
{
  "error": "Invalid or expired token"
}
```

**502 Bad Gateway** - AI 服务调用失败

```json
{
  "error": "upstream_failed"
}
```

**504 Gateway Timeout** - AI 服务超时

```json
{
  "error": "upstream_timeout"
}
```

---

### 1.8 提交答案

语境填空会直接判题并记录；识字辨音会调用 AI 发音评分并记录。接口兼容旧字段 `answer`，但建议使用 `selected_answer` / `selected_index`。

#### 接口信息

- **URL**: `/api/miniprogram/yue_cube_game/submit_answer`
- **方法**: `POST`
- **认证**: 需要 Bearer Token

#### 请求参数 - 语境填空

```json
{
  "mode": "context",
  "question_id": "1",
  "selected_answer": "西多士",
  "selected_index": 0,
  "time": 10
}
```

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `mode` | string | 是 | 固定为 `context` |
| `question_id` | string | 是 | 题目 ID |
| `selected_answer` | string | 否 | 用户选择的答案文本 |
| `selected_index` | number | 否 | 用户选择的选项下标，优先用于判题 |
| `answer` | string/boolean | 否 | 旧字段兼容，不推荐继续使用 |
| `time` | number | 否 | 答题耗时，单位秒 |

#### 请求参数 - 识字辨音

```json
{
  "mode": "sound",
  "question_id": "b3a3c4f1-0000-0000-0000-000000000000",
  "audio": "https://platform-oss/user.mp3",
  "time": 10
}
```

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `mode` | string | 是 | 固定为 `sound` |
| `question_id` | string | 是 | 题目 ID |
| `audio` | string | 是 | 用户录音 URL |
| `time` | number | 否 | 答题耗时，单位秒 |

#### 请求示例

```javascript
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/yue_cube_game/submit_answer',
  method: 'POST',
  header: {
    'Authorization': `Bearer ${accessToken}`
  },
  data: {
    mode: 'context',
    question_id: '1',
    selected_index: 0,
    time: 10
  }
});
```

#### 成功响应 (200) - 语境填空

```json
{
  "success": true,
  "message": "提交成功",
  "is_correct": true,
  "answer": "西多士",
  "answerIndex": 0
}
```

#### 成功响应 (200) - 识字辨音

```json
{
  "success": true,
  "message": "提交成功",
  "is_correct": true,
  "score": 78,
  "comment": "整体很流畅，继续加油！"
}
```

#### 错误响应

**400 Bad Request** - `mode` 参数非法

```json
{
  "error": "Invalid mode. Expected context, sound, or image."
}
```

**400 Bad Request** - 缺少题目 ID

```json
{
  "error": "Missing required field: question_id"
}
```

**400 Bad Request** - 识字辨音缺少录音 URL

```json
{
  "error": "Missing required field: audio"
}
```

**401 Unauthorized** - Token 缺失、无效或过期

```json
{
  "error": "Invalid or expired token"
}
```

**404 Not Found** - 题目不存在

```json
{
  "error": "Question not found"
}
```

**422 Unprocessable Entity** - 识字辨音题目缺少示范音频或粤拼

```json
{
  "error": "Question is missing reference audio or jyutping"
}
```

**502 Bad Gateway** - AI 服务调用失败

```json
{
  "error": "upstream_failed"
}
```

---

## 二、数据记录说明

### 2.1 答题流水

用户答题记录写入 `game_answer_records`，记录时间、用户、题目、所选答案、是否正确、耗时、音频、图片和 AI 原始评分结果。当前版本只留存数据，不做实时个性化出题。

### 2.2 个人进度汇总

个人进度汇总写入 `game_player_progress`，每次提交答案后同步更新。

| 字段 | 说明 |
|------|------|
| `total_time_seconds` | 累计答题耗时 |
| `completed_questions` | 累计完成题数 |
| `correct_questions` / `graded_questions` | 正确题数 / 已判分题数 |
| `accuracy` | 正确率 |
| `level` | 当前等级 |
| `current_streak_days` / `last_played_date` | 连续打卡天数 / 最近游戏日期 |
| `context_completed` / `sound_completed` / `image_completed` | 分题型完成数 |
| `context_correct` / `sound_correct` / `image_correct` | 分题型正确数 |

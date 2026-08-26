# 微信小程序通用接口文档

## 概述

本文档为微信小程序前端开发者提供**通用基础接口**说明（认证、用户、文件上传、错误处理等）。所有接口基于 HTTPS 协议,使用 JSON 格式进行数据交互。

> 业务专属接口请参见 [`business/`](./business/) 目录下的对应文档:
> - [Review App 标注审核小程序接口](./business/review-app/api.md)
> - [粤方块小游戏接口](./business/yue-cube-game/api.md)
> - [语料采集小程序接口](./business/corpus-collection-app/api.md)

### 基础信息

- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: JWT Bearer Token

### 小程序枚举

微信登录支持多个小程序共用同一个登录接口。请求体可通过 `miniprogramApp` 指定当前小程序；不传时默认使用 `review-app`。

| 枚举值 | 小程序 | 说明 |
|--------|--------|------|
| `review-app` | Review App 标注审核小程序 | 默认值，使用 `WECHAT_MINIPROGRAM_APPID` / `WECHAT_MINIPROGRAM_SECRET` |
| `yue-cube-game` | 粤方块小游戏 | 使用 `WECHAT_MINIPROGRAM_YUE_CUBE_GAME_APPID` / `WECHAT_MINIPROGRAM_YUE_CUBE_GAME_SECRET` |
| `corpus-collection-app` | 语料采集小程序 | 使用 `WECHAT_MINIPROGRAM_CORPUS_COLLECTION_APPID` / `WECHAT_MINIPROGRAM_CORPUS_COLLECTION_SECRET` |

### 接口地址

**生产环境**: `https://search.aidimsum.com/api`

---

## 一、认证接口

### 1.1 小程序登录

用户通过微信小程序登录,支持两种登录方式。

#### 接口信息

- **URL**: `/api/miniprogram/auth/login`
- **方法**: `POST`
- **认证**: 无需认证

#### 登录方式

| 方式 | 必填字段 | 说明 |
|-----|---------|------|
| 微信登录 | `code` | 通过 `wx.login()` 获取 |
| 手机号登录 | `phoneNumber`, `verificationCode` | 需先调用发送验证码接口 |

#### 请求参数 - 微信登录

```json
{
  "code": "string, 必填, 微信登录凭证 (通过 wx.login() 获取)",
  "miniprogramApp": "string, 可选, 小程序枚举值，默认 review-app"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 通过 `wx.login()` 获取的微信登录凭证 |
| `miniprogramApp` | string | 否 | 小程序枚举值，可选 `review-app`、`yue-cube-game`、`corpus-collection-app`；默认 `review-app` |

#### 请求参数 - 手机号登录

```json
{
  "phoneNumber": "string, 必填, 手机号码",
  "verificationCode": "string, 必填, 6位短信验证码"
}
```

#### 请求示例 - 微信登录

```javascript
// 小程序端代码
wx.login({
  success: async (res) => {
    if (res.code) {
      const response = await wx.request({
        url: 'https://search.aidimsum.com/api/miniprogram/auth/login',
        method: 'POST',
        data: {
          code: res.code,
          miniprogramApp: 'review-app'
        }
      });

      const { accessToken, refreshToken, user } = response.data;

      // 保存 token
      wx.setStorageSync('accessToken', accessToken);
      wx.setStorageSync('refreshToken', refreshToken);
      wx.setStorageSync('userInfo', user);
    }
  }
});
```

#### 请求示例 - 手机号登录

```javascript
// 小程序端代码 - 先发送验证码,用户输入后登录
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/auth/login',
  method: 'POST',
  data: {
    phoneNumber: '13800138000',
    verificationCode: '123456'
  }
});

const { accessToken, refreshToken, user } = response.data;

// 保存 token
wx.setStorageSync('accessToken', accessToken);
wx.setStorageSync('refreshToken', refreshToken);
wx.setStorageSync('userInfo', user);
```

#### 成功响应 (200)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx123abc456",
    "name": "用户昵称",
    "avatar": "https://wx.qlogo.cn/...",
    "role": "LEARNER",
    "isSystemAdmin": false,
    "questionnaireStatus": {
      "completed": true,
      "phoneVerified": true,
      "completedAt": "2026-08-20T08:00:00.000Z"
    }
  }
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|-----|------|-----|
| `accessToken` | string | 访问令牌,有效期 7 天 |
| `refreshToken` | string | 刷新令牌,有效期 30 天 |
| `user.id` | string | 用户 ID |
| `user.name` | string | 用户昵称 |
| `user.avatar` | string | 用户头像 URL |
| `user.role` | string | 用户角色,枚举值见 [用户角色](#用户角色) |
| `user.isSystemAdmin` | boolean | 是否为系统管理员 |
| `user.questionnaireStatus.completed` | boolean | 是否已有不可变的参赛前问卷档案 |
| `user.questionnaireStatus.phoneVerified` | boolean | 是否已绑定手机号 |
| `user.questionnaireStatus.completedAt` | string \| null | 首次完成问卷时间，ISO 8601；未完成时为 `null` |

#### 错误响应

**400 Bad Request** - 参数错误或验证失败

```json
{
  "error": "Missing required parameters. Provide either 'code' for WeChat login, or 'phoneNumber' and 'verificationCode' for phone login."
}
```

**400 Bad Request** - 小程序枚举值无效

```json
{
  "error": "Invalid miniprogramApp",
  "allowedValues": [
    "review-app",
    "yue-cube-game",
    "corpus-collection-app"
  ]
}
```

**400 Bad Request** - 验证码无效 (手机号登录)

```json
{
  "error": "验证码无效或已过期"
}
```

**404 Not Found** - 微信用户未注册

```json
{
  "error": "User not found. Please register via web first or use phone login.",
  "openid": "oABC123...",
  "unionid": "oUNI456..."
}
```

**404 Not Found** - 手机号用户未注册

```json
{
  "error": "用户不存在，请先通过 Web 端注册或使用微信登录"
}
```

---

### 1.2 发送短信验证码

发送短信验证码用于手机号登录。

#### 接口信息

- **URL**: `/api/miniprogram/auth/send-sms`
- **方法**: `POST`
- **认证**: 无需认证

#### 请求参数

```json
{
  "phoneNumber": "string, 必填, 手机号码"
}
```

#### 请求示例

```javascript
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/auth/send-sms',
  method: 'POST',
  data: {
    phoneNumber: '13800138000'
  }
});

if (response.data.success) {
  console.log('验证码已发送');
}
```

#### 成功响应 (200)

```json
{
  "success": true,
  "message": "验证码已发送",
  "phoneNumber": "138****8000"
}
```

#### 错误响应

**400 Bad Request** - 手机号格式错误

```json
{
  "error": "手机号格式不正确"
}
```

**429 Too Many Requests** - 发送过于频繁

```json
{
  "error": "请稍后再试，验证码发送过于频繁"
}
```

---


### 1.3 刷新访问令牌

当访问令牌过期时,使用刷新令牌获取新的访问令牌。

#### 接口信息

- **URL**: `/api/miniprogram/auth/refresh`
- **方法**: `POST`
- **认证**: 无需认证

#### 请求参数

```json
{
  "refreshToken": "string, 必填, 刷新令牌"
}
```

#### 请求示例

```javascript
const refreshToken = wx.getStorageSync('refreshToken');

const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/auth/refresh',
  method: 'POST',
  data: {
    refreshToken: refreshToken
  }
});

const { accessToken, refreshToken: newRefreshToken } = response.data;

// 更新本地存储
wx.setStorageSync('accessToken', accessToken);
wx.setStorageSync('refreshToken', newRefreshToken);
```

#### 成功响应 (200)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 错误响应

**401 Unauthorized** - 刷新令牌无效或过期

```json
{
  "error": "Invalid or expired refresh token"
}
```

---

## 二、用户接口

### 2.1 获取用户信息

获取当前登录用户的详细信息。

#### 接口信息

- **URL**: `/api/miniprogram/user/profile`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求头

```
Authorization: Bearer <accessToken>
```

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/user/profile',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { user } = response.data;
console.log('用户信息:', user);
```

#### 成功响应 (200)

```json
{
  "user": {
    "id": "clx123abc456",
    "name": "张三",
    "email": "zhangsan@example.com",
    "avatar": "https://wx.qlogo.cn/...",
    "role": "LEARNER",
    "bio": "这是我的个人简介",
    "isSystemAdmin": false,
    "phoneNumber": "13800138000",
    "questionnaireStatus": {
      "completed": true,
      "phoneVerified": true,
      "completedAt": "2026-08-20T08:00:00.000Z"
    }
  }
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|-----|------|-----|
| `user.id` | string | 用户 ID |
| `user.name` | string | 用户昵称 |
| `user.email` | string | 用户邮箱 (可能为空) |
| `user.avatar` | string | 用户头像 URL |
| `user.role` | string | 用户角色 |
| `user.bio` | string | 个人简介 (可能为空) |
| `user.isSystemAdmin` | boolean | 是否为系统管理员 |
| `user.phoneNumber` | string | 手机号 (可能为空) |
| `user.questionnaireStatus.completed` | boolean | 是否已完成参赛前问卷 |
| `user.questionnaireStatus.phoneVerified` | boolean | 是否已绑定手机号 |
| `user.questionnaireStatus.completedAt` | string \| null | 首次完成问卷时间，未完成时为 `null` |

`questionnaireStatus` 用于小程序提前决定问卷相关 UI。活动投稿和自由投稿都受问卷门禁影响，并调用 `/api/miniprogram/corpus_collection/questionnaire/entry` 准备对应的 `questionnaireJourneyId`；自由投稿调用时省略 `activityId`。

#### 错误响应

**401 Unauthorized** - 访问令牌无效或过期

```json
{
  "error": "Unauthorized"
}
```

**404 Not Found** - 用户不存在

```json
{
  "error": "User not found"
}
```

---

### 2.2 批量获取用户公开信息

根据用户 ID 批量获取用户的公开信息（用于显示用户头像、昵称等）。

#### 接口信息

- **URL**: `/api/miniprogram/users/public`
- **方法**: `GET`
- **认证**: 无需认证

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `userIds` | string | 是 | 用户 ID 列表，支持逗号分隔字符串（如 "id1,id2,id3"）或 JSON 数组格式（如 ["id1","id2","id3"]），单次最多 100 个 |

#### 请求示例

```javascript
// 方式 1: 使用逗号分隔的字符串
const userIds = ['user_001', 'user_002', 'user_003'];
const response = await wx.request({
  url: `https://search.aidimsum.com/api/miniprogram/users/public?userIds=${userIds.join(',')}`,
  method: 'GET'
});

// 方式 2: 使用 JSON 数组字符串
const response = await wx.request({
  url: `https://search.aidimsum.com/api/miniprogram/users/public?userIds=${encodeURIComponent(JSON.stringify(userIds))}`,
  method: 'GET'
});

const { users, total } = response.data;
console.log('用户信息列表:', users);
```

#### 成功响应 (200)

```json
{
  "users": [
    {
      "userId": "clx123abc456",
      "username": "张三",
      "avatar": "https://wx.qlogo.cn/..."
    },
    {
      "userId": "clx456def789",
      "username": "李四",
      "avatar": null
    },
    {
      "userId": "clx789ghi012",
      "username": "匿名用户",
      "avatar": "https://thirdwx.qlogo.cn/..."
    }
  ],
  "total": 3
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|-----|------|-----|
| `users` | array | 用户公开信息数组 |
| `users[].userId` | string | 用户 ID |
| `users[].username` | string | 用户昵称，如果用户未设置昵称则显示 "匿名用户" |
| `users[].avatar` | string \| null | 用户头像 URL，优先返回微信头像，可能为 null |
| `total` | number | 返回的用户数量 |

#### 注意事项

- 仅返回状态为 `ACTIVE` 的用户
- 如果某个用户 ID 不存在或用户已被删除，不会在结果中返回
- 头像优先使用微信头像 (`wechatAvatar`)，如果没有则使用普通头像 (`image`)
- 单次请求最多支持查询 100 个用户 ID

#### 错误响应

**400 Bad Request** - 缺少必填参数

```json
{
  "error": "Missing required parameter: userIds"
}
```

**400 Bad Request** - 用户 ID 为空

```json
{
  "error": "No valid user IDs provided"
}
```

**400 Bad Request** - 超过最大限制

```json
{
  "error": "Maximum 100 user IDs allowed per request"
}
```

**500 Internal Server Error** - 服务器错误

```json
{
  "error": "Internal server error"
}
```

---

### 2.3 上传资源

将文件 (如音频) 上传到 OSS。

> **注意**: 接口本身是通用基础设施，但角色权限按业务约束。当前仅放开给标注员 (`TAGGER_PARTNER`、`TAGGER_OUTSOURCING`) 与研究员 (`RESEARCHER`)。新增其他业务时，按需调整服务端权限白名单即可。

#### 接口信息

- **URL**: `/api/miniprogram/upload`
- **方法**: `POST`
- **认证**: 需要 Bearer Token
- **权限**: 仅限标注员 (`TAGGER_PARTNER`, `TAGGER_OUTSOURCING`) 和研究员 (`RESEARCHER`)

#### 请求头

```
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|-----|
| `file` | File | 是 | 要上传的文件 (如音频文件) |
| `fileName` | string | 否 | 自定义文件名 (包含扩展名), 若不传则使用原文件名 |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

wx.uploadFile({
  url: 'https://search.aidimsum.com/api/miniprogram/upload',
  filePath: tempFilePath, // 临时文件路径
  name: 'file',
  formData: {
    'fileName': 'custom_name.mp3' // 可选: 自定义文件名
  },
  header: {
    'Authorization': `Bearer ${accessToken}`
  },
  success(res) {
    const data = JSON.parse(res.data);
    console.log('上传结果:', data);
  },
  fail(err) {
    console.error('上传失败:', err);
  }
});
```

#### 成功响应 (200)

```json
{
  "success": true,
  "url": "https://dimsum-audio.oss-cn-guangzhou.aliyuncs.com/tagger/filename.mp3",
  "key": "tagger/filename.mp3"
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|-----|------|-----|
| `success` | boolean | 上传是否成功 |
| `url` | string | 文件访问 URL |
| `key` | string | OSS 存储键值 |

#### 错误响应

**403 Forbidden** - 权限不足

```json
{
  "error": "Insufficient permissions"
}
```

**500 Internal Server Error** - 上传失败

```json
{
  "error": "Upstream upload failed",
  "details": "具体错误信息"
}
```

---

## 三、数据类型定义

### 分页对象

| 字段 | 类型 | 说明 |
|-----|------|-----|
| `page` | number | 当前页码 |
| `pageSize` | number | 每页数量 |
| `total` | number | 总数 |

### 用户角色

用户在系统中的角色类型。

| 值 | 说明 |
|----|------|
| `LEARNER` | 学习者 (普通用户) |
| `TAGGER_PARTNER` | 标注员 (合作伙伴) |
| `TAGGER_OUTSOURCING` | 标注员 (外包) |
| `RESEARCHER` | 研究员 |

### Token 有效期

| Token 类型 | 有效期 | 用途 |
|-----------|--------|------|
| Access Token | 7 天 | API 访问认证 |
| Refresh Token | 30 天 | 刷新 Access Token |

---

## 四、错误处理

### 错误响应格式

所有错误响应遵循以下格式:

```json
{
  "error": "错误描述信息",
  "details": "详细错误信息 (可选)"
}
```

### 常见错误码

| HTTP 状态码 | 含义 | 处理建议 |
|-----------|------|---------|
| `400` | 请求参数错误 | 检查请求参数格式和必填字段 |
| `401` | 未授权 (Token 无效或过期) | 使用 refresh token 刷新,失败则重新登录 |
| `403` | 权限不足 | 提示用户当前操作需要更高权限 |
| `404` | 资源不存在 | 检查请求的资源是否存在 |
| `500` | 服务器内部错误 | 提示用户稍后重试 |

---

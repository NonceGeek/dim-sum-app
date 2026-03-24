# 微信小程序前端接口文档

## 概述

本文档为微信小程序前端开发者提供完整的 API 接口说明。所有接口基于 HTTPS 协议,使用 JSON 格式进行数据交互。

### 基础信息

- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: JWT Bearer Token

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
  "code": "string, 必填, 微信登录凭证 (通过 wx.login() 获取)"
}
```

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
          code: res.code
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
    "isSystemAdmin": false
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

#### 错误响应

**400 Bad Request** - 参数错误或验证失败

```json
{
  "error": "Missing required parameters. Provide either 'code' for WeChat login, or 'phoneNumber' and 'verificationCode' for phone login."
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
    "phoneNumber": "13800138000"
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

标注员上传音频等资源文件到 OSS。

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

## 三、任务接口

> 任务接口使用标注员认证 (`requireMiniprogramMarker`),允许角色: `TAGGER_PARTNER`、`TAGGER_OUTSOURCING`、`RESEARCHER`。
>
> **`actorRef` 与 `assigneeRef` 的区别**:
> - `actorRef`: 当前调用接口的用户 ID,用于权限控制和审计,由服务端从 Token 中获取,前端无需传递
> - `assigneeRef`: 要查看谁的任务列表,选填;不传时默认查看 `actorRef` 自己的任务

### 3.1 获取未完成任务列表

获取当前用户 (或指定标注员) 的未完成任务列表。

#### 接口信息

- **URL**: `/api/miniprogram/task/uncompleted`
- **方法**: `GET`
- **认证**: 需要 Bearer Token (标注员)

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `status` | string | 否 | `created,notified,in_progress,reassigning` | 任务状态,多个用逗号分隔 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `10` | 每页数量 |
| `assigneeRef` | string | 否 | - | 要查看谁的任务列表;不传时查看自己的任务 |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/task/uncompleted?page=1&pageSize=10',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { items, pagination } = response.data;
```

#### 成功响应 (200)

```json
{
  "items": [
    {
      "id": "task_001",
      "status": "created",
      "violationType": "pronunciation",
      "context": {
        "corpusName": "corpus_a",
        "corpusUniqueId": "unique_001",
        "sentenceText": "示例句子",
        "problemChar": "字"
      },
      "suggestions": [
        {
          "source": "lexicon",
          "value": "建议值",
          "lexiconBaseCorpusName": "base_corpus",
          "position": { "index": 0 },
          "explanation": "说明"
        }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "actorRef": "user_id",
      "processedBy": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 50
  }
}
```

#### 错误响应

**400 Bad Request** - 缺少用户标识

```json
{
  "error": "Missing user identifier"
}
```

---

### 3.2 获取已完成任务列表

获取当前用户 (或指定标注员) 的已完成任务列表。

#### 接口信息

- **URL**: `/api/miniprogram/task/completed`
- **方法**: `GET`
- **认证**: 需要 Bearer Token (标注员)

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `status` | string | 否 | `completed` | 任务状态 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `10` | 每页数量 |
| `assigneeRef` | string | 否 | - | 要查看谁的任务列表;不传时查看自己的任务 |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/task/completed?page=1&pageSize=10',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 成功响应 (200)

响应格式与 [3.1 获取未完成任务列表](#31-获取未完成任务列表) 相同。

---

### 3.3 获取任务列表 (通用)

获取当前用户 (或指定标注员) 的任务列表,支持按状态、语料库、违规类型等全量筛选条件查询。

> 与 3.1/3.2 的区别: 本接口不预设 `status` 默认值,所有筛选条件均由调用方自由传入,适合需要灵活组合查询的场景。

#### 接口信息

- **URL**: `/api/miniprogram/task/list`
- **方法**: `GET`
- **认证**: 需要 Bearer Token (标注员)

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `status` | string | 否 | - | 任务状态,多个用逗号分隔;不传则不过滤状态 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `10` | 每页数量 |
| `assigneeRef` | string | 否 | - | 要查看谁的任务列表;不传时查看自己的任务 |
| `corpusName` | string | 否 | - | 按语料库名称筛选 |
| `violationType` | string | 否 | - | 按违规类型筛选 |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

// 查询指定语料库下进行中的任务
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/task/list?status=in_progress&corpusName=corpus_a&page=1&pageSize=20',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { items, pagination } = response.data;
```

#### 成功响应 (200)

响应格式与 [3.1 获取未完成任务列表](#31-获取未完成任务列表) 相同。

#### 错误响应

**400 Bad Request** - 缺少用户标识

```json
{
  "error": "Missing user identifier"
}
```

---

### 3.4 获取任务详情

根据任务 ID 获取单个任务的详细信息。

#### 接口信息

- **URL**: `/api/miniprogram/task/{id}`
- **方法**: `GET`
- **认证**: 需要 Bearer Token (标注员)

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `id` | string | 是 | 任务 ID |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: `https://search.aidimsum.com/api/miniprogram/task/${taskId}`,
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const task = response.data;
```

#### 成功响应 (200)

返回单个任务对象,结构见 [任务对象](#任务对象)。

#### 错误响应

**400 Bad Request** - 缺少任务 ID

```json
{
  "error": "Missing task id"
}
```

---

### 3.5 标记任务已查看

标记指定任务为已查看状态。

#### 接口信息

- **URL**: `/api/miniprogram/task/{id}/view`
- **方法**: `POST`
- **认证**: 需要 Bearer Token (标注员)

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `id` | string | 是 | 任务 ID |

#### 请求参数 (Body)

```json
{
  "actorRef": "string, 必填, 当前操作者的用户 ID"
}
```

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: `https://search.aidimsum.com/api/miniprogram/task/${taskId}/view`,
  method: 'POST',
  header: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  data: {
    actorRef: userId
  }
});
```

#### 错误响应

**400 Bad Request**

```json
{
  "error": "Missing task id"
}
```

```json
{
  "error": "Missing actorRef"
}
```

---

### 3.6 提交任务

提交任务的标注结果。

#### 接口信息

- **URL**: `/api/miniprogram/task/submit/{id}`
- **方法**: `POST`
- **认证**: 需要 Bearer Token (标注员)

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `id` | string | 是 | 任务 ID |

#### 请求参数 (Body)

```json
{
  "selected": ["array, 必填, 选中的标注结果数组"],
  "entries": ["array, 与 selected 二选一, 兼容旧字段"]
}
```

> `selected` 和 `entries` 二选一,优先使用 `selected`。数组不能为空。

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: `https://search.aidimsum.com/api/miniprogram/task/submit/${taskId}`,
  method: 'POST',
  header: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  data: {
    selected: [
      { "value": "标注结果1" },
      { "value": "标注结果2" }
    ]
  }
});
```

#### 错误响应

**400 Bad Request**

```json
{
  "error": "Missing task id"
}
```

```json
{
  "error": "entries or selected field is required"
}
```

```json
{
  "error": "Missing user identifier"
}
```

---

### 3.7 跳过/取消任务

跳过当前任务并重新分配给其他标注员。

#### 接口信息

- **URL**: `/api/miniprogram/task/cancel/{id}`
- **方法**: `POST`
- **认证**: 需要 Bearer Token (标注员)

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `id` | string | 是 | 任务 ID |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: `https://search.aidimsum.com/api/miniprogram/task/cancel/${taskId}`,
  method: 'POST',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 错误响应

**400 Bad Request**

```json
{
  "error": "Missing task id"
}
```

```json
{
  "error": "Missing user identifier"
}
```

---

### 3.8 获取任务统计

获取指定语料库的任务完成统计,支持按标注员筛选。

#### 接口信息

- **URL**: `/api/miniprogram/task/stats`
- **方法**: `GET`
- **认证**: 需要 Bearer Token (标注员)

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `corpusName` | string | 是 | 语料库名称,多个名称用英文逗号分隔 |
| `assigneeRef` | string | 否 | 标注员 ID,多个 ID 用英文逗号分隔;不传则统计所有标注员 |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/task/stats?corpusName=corpus_a,corpus_b',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { summary, assignees } = response.data;
```

#### 成功响应 (200)

```json
{
  "filters": {
    "corpusIds": ["corpus_a", "corpus_b"],
    "assigneeRefs": ["user_001", "user_002"]
  },
  "summary": {
    "totalCount": 100,
    "processedCount": 60,
    "unprocessedCount": 40,
    "totalCorpusCount": 500,
    "completionRate": 0.6000
  },
  "assignees": [
    {
      "id": "user_001",
      "name": "张三",
      "avatar": "https://wx.qlogo.cn/..."
    },
    {
      "id": "user_002",
      "name": "李四",
      "avatar": null
    }
  ]
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|-----|------|-----|
| `filters.corpusIds` | string[] | 匹配到的语料库 ID 列表 |
| `filters.assigneeRefs` | string[] | 匹配到的标注员 ID 列表 |
| `summary.totalCount` | number | 符合筛选条件的任务总数 |
| `summary.processedCount` | number | 已完成的任务数 |
| `summary.unprocessedCount` | number | 未完成的任务数 |
| `summary.totalCorpusCount` | number \| null | 语料库中的记录总数,无法获取时为 null |
| `summary.completionRate` | number | 完成率 = processedCount / totalCount,保留 4 位小数 |
| `assignees` | array | 标注员用户信息列表 (由服务端根据 assigneeRefs 查询数据库补充) |
| `assignees[].id` | string | 用户 ID |
| `assignees[].name` | string \| null | 用户名 |
| `assignees[].avatar` | string \| null | 用户头像 URL |

#### 错误响应

**400 Bad Request** - 缺少必填参数

```json
{
  "error": "Missing required parameter: corpusName"
}
```

---

## 四、数据类型定义

### 任务对象

任务列表和详情接口返回的任务数据结构。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| `id` | string | 任务 ID |
| `status` | string | 任务状态,见 [任务状态](#任务状态) |
| `violationType` | string | 违规类型 |
| `context` | object | 任务上下文 |
| `context.corpusName` | string | 语料库名称 |
| `context.corpusUniqueId` | string | 语料库唯一 ID |
| `context.sentenceText` | string | 句子文本 |
| `context.problemChar` | string | 问题字符 |
| `suggestions` | array | 建议列表 (可选) |
| `suggestions[].source` | string | 建议来源: `lexicon` 或 `llm` |
| `suggestions[].value` | string | 建议值 |
| `suggestions[].lexiconBaseCorpusName` | string | 词典基础语料库名称 (可选) |
| `suggestions[].position` | object | 位置信息 (可选) |
| `suggestions[].position.index` | number | 索引位置 |
| `suggestions[].explanation` | string | 说明 (可选) |
| `createdAt` | string | 创建时间 (ISO 8601) |
| `updatedAt` | string | 更新时间 (可选) |
| `completedAt` | string | 完成时间 (可选) |
| `actorRef` | string | 分配给的用户 ID (可选) |
| `processedBy` | string | 处理者 ID (可选) |

### 任务状态

| 值 | 说明 |
|----|------|
| `created` | 已创建 |
| `notified` | 已通知 |
| `in_progress` | 进行中 |
| `reassigning` | 重新分配中 |
| `completed` | 已完成 |
| `cancelled` | 已取消 |

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

## 五、错误处理

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

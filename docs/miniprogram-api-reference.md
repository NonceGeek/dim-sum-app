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

用户通过微信小程序登录,获取访问令牌。

#### 接口信息

- **URL**: `/api/miniprogram/auth/login`
- **方法**: `POST`
- **认证**: 无需认证

#### 请求参数

```json
{
  "code": "string, 必填, 微信登录凭证 (通过 wx.login() 获取)"
}
```

#### 请求示例

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

**400 Bad Request** - 参数错误或微信验证失败

```json
{
  "error": "Failed to authenticate with WeChat",
  "details": "invalid code"
}
```

**404 Not Found** - 用户未注册

```json
{
  "error": "User not found. Please register via web first.",
  "openid": "oABC123...",
  "unionid": "oUNI456..."
}
```

> **注意**: 用户必须先通过 Web 端注册账号,小程序才能登录成功。

---

### 1.2 刷新访问令牌

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

### 2.2 上传资源

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

## 三、数据类型定义

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

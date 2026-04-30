# 微信小程序认证指南

## 概述

小程序认证系统与 Web 端（NextAuth.js）分离，使用独立的 JWT token 进行身份验证。

### 认证架构

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────┐
│  微信小程序端    │ ────>│  API 服务器       │ ────>│  数据库      │
│  (wx.login)     │ code │  /api/miniprogram │ JWT  │  (Prisma)   │
└─────────────────┘      └──────────────────┘      └─────────────┘
        │                         │
        │  accessToken            │
        │  refreshToken           │
        └─────────────────────────┘
```

### 与 Web 端的区别

| 特性 | Web 端 (NextAuth.js) | 小程序端 (JWT) |
|------|---------------------|----------------|
| **认证方式** | Cookie (HTTP-only) | Authorization Header |
| **Token 存储** | 浏览器 Cookie | 小程序本地存储 |
| **登录流程** | OAuth 重定向 | wx.login() + code 换 token |
| **中间件** | NextAuth middleware | 自定义 JWT 中间件 |
| **密钥共享** | ✅ 使用相同的 `NEXTAUTH_SECRET` | ✅ 使用相同的 `NEXTAUTH_SECRET` |

## 环境配置

### 1. 环境变量

在 `.env.local` 中添加：

```bash
# NextAuth (Web 和小程序共用)
NEXTAUTH_SECRET="your-secret-key"

# 微信小程序配置 - review-app（默认）
WECHAT_MINIPROGRAM_APPID="your-review-app-appid"
WECHAT_MINIPROGRAM_SECRET="your-review-app-secret"

# 微信小程序配置 - yue-cube-game
WECHAT_MINIPROGRAM_YUE_CUBE_GAME_APPID="your-yue-cube-game-appid"
WECHAT_MINIPROGRAM_YUE_CUBE_GAME_SECRET="your-yue-cube-game-secret"

# 微信小程序配置 - corpus-collection-app
WECHAT_MINIPROGRAM_CORPUS_COLLECTION_APPID="your-corpus-collection-app-appid"
WECHAT_MINIPROGRAM_CORPUS_COLLECTION_SECRET="your-corpus-collection-app-secret"
```

### 2. 获取小程序 AppID 和 Secret

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入"开发" > "开发管理" > "开发设置"
3. 获取 AppID（小程序 ID）和 AppSecret

### 3. 小程序枚举

登录接口通过 `miniprogramApp` 区分不同小程序。不传时默认使用 `review-app`，兼容历史调用。

| 枚举值 | 小程序 | 环境变量 |
|--------|--------|----------|
| `review-app` | Review App 标注审核小程序 | `WECHAT_MINIPROGRAM_APPID` / `WECHAT_MINIPROGRAM_SECRET` |
| `yue-cube-game` | 粤方块小游戏 | `WECHAT_MINIPROGRAM_YUE_CUBE_GAME_APPID` / `WECHAT_MINIPROGRAM_YUE_CUBE_GAME_SECRET` |
| `corpus-collection-app` | 语料采集小程序 | `WECHAT_MINIPROGRAM_CORPUS_COLLECTION_APPID` / `WECHAT_MINIPROGRAM_CORPUS_COLLECTION_SECRET` |

## 认证流程

### 1. 小程序登录

#### 端侧代码（小程序）

```javascript
// pages/login/login.js

// 1. 调用 wx.login 获取 code
wx.login({
  success: async (res) => {
    if (res.code) {
      try {
        // 2. 发送 code 到服务器
        const loginRes = await wx.request({
          url: 'https://your-domain.com/api/miniprogram/auth/login',
          method: 'POST',
          data: {
            code: res.code,
            miniprogramApp: 'review-app'
          }
        });

        const { accessToken, refreshToken, user } = loginRes.data;

        // 3. 保存 token 到本地存储
        wx.setStorageSync('accessToken', accessToken);
        wx.setStorageSync('refreshToken', refreshToken);
        wx.setStorageSync('userInfo', user);

        // 4. 跳转到首页
        wx.switchTab({
          url: '/pages/index/index'
        });

      } catch (error) {
        console.error('登录失败:', error);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
      }
    } else {
      console.error('wx.login 失败:', res.errMsg);
    }
  }
});
```

#### API 端点

**POST** `/api/miniprogram/auth/login`

**请求体**:
```json
{
  "code": "wx_login_code_from_wx.login()",
  "miniprogramApp": "review-app"
}
```

`miniprogramApp` 为可选字段，允许值为 `review-app`、`yue-cube-game`、`corpus-collection-app`。不传时默认 `review-app`。

**成功响应** (200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx123abc456",
    "name": "用户昵称",
    "avatar": "https://...",
    "role": "LEARNER",
    "isSystemAdmin": false
  }
}
```

**错误响应**:

- **400** - 缺少 code 或微信验证失败
  ```json
  {
    "error": "Failed to authenticate with WeChat",
    "details": "invalid code"
  }
  ```

- **400** - 小程序枚举值无效
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

- **404** - 用户未注册
  ```json
  {
    "error": "User not found. Please register via web first.",
    "openid": "oABC123...",
    "unionid": "oUNI456..."
  }
  ```

**注意**：用户必须先通过 Web 端注册账号，小程序才能登录。

### 2. Token 刷新

Access token 有效期为 7 天，refresh token 有效期为 30 天。

```javascript
// utils/auth.js

async function refreshAccessToken() {
  try {
    const refreshToken = wx.getStorageSync('refreshToken');

    if (!refreshToken) {
      throw new Error('No refresh token found');
    }

    const res = await wx.request({
      url: 'https://your-domain.com/api/miniprogram/auth/refresh',
      method: 'POST',
      data: {
        refreshToken: refreshToken
      }
    });

    const { accessToken, refreshToken: newRefreshToken } = res.data;

    // 更新本地存储
    wx.setStorageSync('accessToken', accessToken);
    wx.setStorageSync('refreshToken', newRefreshToken);

    return accessToken;
  } catch (error) {
    console.error('Token 刷新失败:', error);
    // 跳转到登录页
    wx.redirectTo({
      url: '/pages/login/login'
    });
    throw error;
  }
}

module.exports = {
  refreshAccessToken
};
```

#### API 端点

**POST** `/api/miniprogram/auth/refresh`

**请求体**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应**:
```json
{
  "accessToken": "new_access_token",
  "refreshToken": "new_refresh_token"
}
```

### 3. 调用受保护的 API

所有受保护的 API 都需要在请求头中携带 access token。

#### 封装请求方法

```javascript
// utils/request.js
const { refreshAccessToken } = require('./auth.js');

async function request(options) {
  const accessToken = wx.getStorageSync('accessToken');

  if (!accessToken) {
    wx.redirectTo({
      url: '/pages/login/login'
    });
    return Promise.reject(new Error('未登录'));
  }

  // 添加 Authorization header
  options.header = {
    ...options.header,
    'Authorization': `Bearer ${accessToken}`
  };

  try {
    const res = await wx.request(options);
    return res.data;
  } catch (error) {
    // 如果是 401 错误，尝试刷新 token
    if (error.statusCode === 401) {
      try {
        const newAccessToken = await refreshAccessToken();

        // 使用新 token 重试请求
        options.header.Authorization = `Bearer ${newAccessToken}`;
        const retryRes = await wx.request(options);
        return retryRes.data;
      } catch (refreshError) {
        // 刷新失败，跳转登录页
        wx.redirectTo({
          url: '/pages/login/login'
        });
        throw refreshError;
      }
    }
    throw error;
  }
}

module.exports = {
  request
};
```

#### 使用示例

```javascript
// pages/profile/profile.js
const { request } = require('../../utils/request.js');

Page({
  data: {
    userProfile: null
  },

  onLoad: async function() {
    try {
      const data = await request({
        url: 'https://your-domain.com/api/miniprogram/user/profile',
        method: 'GET'
      });

      this.setData({
        userProfile: data.user
      });
    } catch (error) {
      console.error('获取用户信息失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  }
});
```

## 服务端开发

### 1. 创建受保护的 API 路由

使用认证中间件保护你的 API 端点：

```typescript
// app/api/miniprogram/data/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 获取数据列表
 * GET /api/miniprogram/data/list
 */
export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async (req, user) => {
    // user 包含: userId, openId, unionId, role, isSystemAdmin

    const data = await prisma.someModel.findMany({
      where: { userId: user.userId },
      take: 20
    });

    return NextResponse.json({ data });
  });
}
```

### 2. 可用的认证中间件

```typescript
import {
  requireMiniprogramAuth,      // 基础认证
  requireMiniprogramRole,       // 角色认证
  requireMiniprogramMarker,     // 标记员认证
  requireMiniprogramAdmin       // 管理员认证
} from "@/lib/miniprogram-auth";
```

#### 基础认证

```typescript
export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async (req, user) => {
    // 任何已登录用户都可以访问
    return NextResponse.json({ message: "Hello" });
  });
}
```

#### 角色认证

```typescript
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  return requireMiniprogramRole(
    req,
    [Role.TAGGER_PARTNER, Role.TAGGER_OUTSOURCING],
    async (req, user) => {
      // 只有标记员可以访问
      return NextResponse.json({ message: "Tagger only" });
    }
  );
}
```

#### 标记员认证（快捷方式）

```typescript
export async function POST(req: NextRequest) {
  return requireMiniprogramMarker(req, async (req, user) => {
    // 只有 TAGGER_PARTNER 或 TAGGER_OUTSOURCING 可以访问
    return NextResponse.json({ message: "Marker only" });
  });
}
```

#### 管理员认证

```typescript
export async function DELETE(req: NextRequest) {
  return requireMiniprogramAdmin(req, async (req, user) => {
    // 只有系统管理员可以访问
    return NextResponse.json({ message: "Admin only" });
  });
}
```

### 3. 用户信息结构

认证中间件传递的 `user` 对象包含：

```typescript
interface MiniprogramTokenPayload {
  userId: string;          // 用户 ID
  openId: string;          // 微信 openId
  unionId?: string;        // 微信 unionId（如果有）
  role: Role;              // 用户角色
  isSystemAdmin: boolean;  // 是否为系统管理员
}
```

## Token 安全说明

### Access Token
- **有效期**: 7 天
- **用途**: API 访问认证
- **存储位置**: 小程序本地存储
- **传输方式**: Authorization Header

### Refresh Token
- **有效期**: 30 天
- **用途**: 刷新 access token
- **存储位置**: 小程序本地存储
- **使用频率**: 仅在 access token 过期时使用

### 安全建议

1. **Token 存储**
   ```javascript
   // ✅ 推荐：使用 wx.setStorageSync
   wx.setStorageSync('accessToken', token);

   // ❌ 不推荐：存储在全局变量中
   getApp().globalData.token = token;
   ```

2. **Token 传输**
   ```javascript
   // ✅ 推荐：使用 HTTPS + Authorization header
   wx.request({
     url: 'https://your-domain.com/api/...',  // HTTPS
     header: {
       'Authorization': `Bearer ${token}`
     }
   });

   // ❌ 不推荐：在 URL 中传递 token
   wx.request({
     url: `https://your-domain.com/api?token=${token}`
   });
   ```

3. **Token 刷新策略**
   - 在 401 错误时自动刷新
   - 刷新失败后跳转到登录页
   - 不要在多个请求中并发刷新

4. **退出登录**
   ```javascript
   function logout() {
     wx.removeStorageSync('accessToken');
     wx.removeStorageSync('refreshToken');
     wx.removeStorageSync('userInfo');
     wx.redirectTo({
       url: '/pages/login/login'
     });
   }
   ```

## 错误处理

### 常见错误码

| 状态码 | 含义 | 处理方式 |
|--------|------|----------|
| **400** | 请求参数错误 | 检查请求参数格式 |
| **401** | Token 无效或过期 | 尝试刷新 token，失败则重新登录 |
| **403** | 权限不足 | 提示用户权限不足 |
| **404** | 用户不存在 | 引导用户先在 Web 端注册 |
| **500** | 服务器错误 | 提示用户稍后重试 |

### 错误处理示例

```javascript
// utils/request.js

async function request(options) {
  try {
    const res = await wx.request(options);
    return res.data;
  } catch (error) {
    const statusCode = error.statusCode;

    switch (statusCode) {
      case 401:
        // Token 过期，尝试刷新
        return await handleTokenExpired(options);

      case 403:
        wx.showToast({
          title: '权限不足',
          icon: 'none'
        });
        break;

      case 404:
        wx.showModal({
          title: '提示',
          content: '账号未注册，请先在网页端注册',
          confirmText: '我知道了'
        });
        break;

      case 500:
        wx.showToast({
          title: '服务器错误，请稍后重试',
          icon: 'none'
        });
        break;

      default:
        wx.showToast({
          title: '请求失败',
          icon: 'none'
        });
    }

    throw error;
  }
}
```

## 测试

### 测试登录流程

1. 在微信开发者工具中打开小程序
2. 点击登录按钮
3. 检查控制台输出和本地存储：
   ```javascript
   console.log('Access Token:', wx.getStorageSync('accessToken'));
   console.log('Refresh Token:', wx.getStorageSync('refreshToken'));
   console.log('User Info:', wx.getStorageSync('userInfo'));
   ```

### 测试 API 调用

```javascript
// 测试受保护的 API
const { request } = require('../../utils/request.js');

async function testAPI() {
  try {
    // 测试获取用户信息
    const profileRes = await request({
      url: 'https://your-domain.com/api/miniprogram/user/profile',
      method: 'GET'
    });
    console.log('Profile:', profileRes);

    // 测试权限控制
    const markerRes = await request({
      url: 'https://your-domain.com/api/miniprogram/marker/data',
      method: 'GET'
    });
    console.log('Marker data:', markerRes);

  } catch (error) {
    console.error('API 测试失败:', error);
  }
}
```

## 常见问题

### Q1: 用户必须先在 Web 端注册吗？

**是的**。小程序登录流程依赖数据库中已有的用户账号。登录流程：
1. 用户在 Web 端通过微信 OAuth 登录（自动创建账号）
2. 系统记录用户的 openId 和 unionId
3. 小程序端使用相同的 openId/unionId 查找用户并颁发 token

### Q2: 小程序和 Web 端的用户数据是互通的吗？

**是的**。小程序和 Web 端共享同一个数据库，使用相同的用户表。只是认证方式不同：
- Web 端：Cookie-based (NextAuth.js)
- 小程序端：Token-based (JWT)

### Q3: 如何在小程序端实现自动注册？

如需支持小程序端直接注册，可以修改登录 API：

```typescript
// app/api/miniprogram/auth/login/route.ts

if (!account) {
  // 自动创建新用户
  const newUser = await prisma.user.create({
    data: {
      name: `User_${openid.slice(-6)}`,
      role: Role.LEARNER,
      accounts: {
        create: {
          type: 'oauth',
          provider: 'wechat',
          providerAccountId: openid,
          openId: openid,
          unionId: unionid,
        }
      }
    }
  });
  // 继续颁发 token...
}
```

### Q4: Token 刷新失败怎么办？

Token 刷新失败通常意味着 refresh token 也过期了（30 天）。此时应：
1. 清除本地存储的 token
2. 跳转到登录页
3. 重新调用 wx.login() 登录

### Q5: 如何强制用户重新登录？

服务端无法主动使 JWT token 失效。如需强制重新登录：
- 方案1：在数据库中添加 `tokenVersion` 字段，登出时递增版本号
- 方案2：维护一个黑名单（Redis）存储已失效的 token ID
- 方案3：缩短 token 有效期（如 1 小时）

### Q6: 新增小程序时如何接入同一个登录接口？

1. 在服务端枚举中新增一个 `miniprogramApp` 值
2. 为新小程序添加独立的 AppID 和 AppSecret 环境变量
3. 在登录接口配置映射中把枚举值关联到对应环境变量
4. 小程序端登录请求传入新的 `miniprogramApp`

不要从小程序端传 `appSecret`，端侧只传枚举值，密钥始终保存在服务端。

## 相关文件

### 核心文件
- `lib/miniprogram-jwt.ts` - JWT token 生成和验证
- `lib/miniprogram-auth.ts` - 认证中间件
- `app/api/miniprogram/auth/login/route.ts` - 登录 API
- `app/api/miniprogram/auth/refresh/route.ts` - Token 刷新 API
- `middleware.ts` - 路由保护配置

### 文档
- `CLAUDE.md` - 项目整体文档
- `docs/auth-session-modes.md` - Web 端认证模式说明

## 更新日志

- **2026-04-30**: 支持 `review-app`、`yue-cube-game`、`corpus-collection-app` 多小程序登录枚举
- **2024-10-27**: 初始版本，支持基于 JWT 的小程序认证

# 邮箱验证设置

本文档介绍本地开发配置邮箱登录功能

## 前提条件

1. 在 [https://resend.com](https://resend.com) 创建Resend账户
2. 从Resend仪表板获取您的API密钥

## 环境变量

将以下环境变量添加到 `.env.local` 文件中：

```bash
# Resend邮件服务
RESEND_API_KEY="your-resend-api-key"

# 开发环境：Resend注册邮箱（可选，默认为dimsumaiapp@gmail.com）
RESEND_REGISTERED_EMAIL="your-resend-registered-email@gmail.com"
```

## 域名配置

### 开发环境
在开发环境中：
- **发件人地址**：使用 `onboarding@resend.dev`（Resend的默认测试域名）
- **收件人地址**：只能是你注册Resend时使用的邮箱地址

**注意**：测试模式下，无论用户输入什么邮箱，验证码都会发送到你注册Resend时使用的邮箱地址。

### 生产环境
1. 在Resend仪表板中添加域名 `aidimsum.com`
2. 通过添加所需的DNS记录来验证域名
3. 生产环境将自动使用 `noreply@aidimsum.com` 作为发件人

## 功能

- **邮箱验证**：用户通过邮件接收一个6位数的验证码
- **验证码过期**：验证码在10分钟后过期
- **重新发送功能**：用户在需要时可以请求新验证码
- **智能用户管理**：验证成功后，如果用户不存在则创建新用户，如果用户已存在则直接登录
- **角色分配**：新用户在注册时被分配所选角色

## API 端点

### 发送验证码
- **POST** `/api/auth/send-verification`
- **请求体**: `{ email: string, role: string }`
- **响应**: `{ success: boolean ,message: string, email: string }`

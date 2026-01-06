# 短信验证码登录设置

本文档介绍如何配置阿里云短信服务实现手机号验证码登录功能。

## 功能说明

- **登录即注册**：新手机号自动创建用户账号
- **注册即登录**：已注册手机号直接登录
- **验证码过期**：验证码在 10 分钟后过期
- **频率限制**：60 秒内不可重复发送

## 前提条件

1. 在 [阿里云](https://dysms.console.aliyun.com/) 开通短信服务
2. 创建并审核通过短信签名
3. 创建并审核通过验证码模板（模板需包含 `${code}` 变量）
4. 获取 AccessKey ID 和 AccessKey Secret

## 环境变量

将以下环境变量添加到 `.env` 文件中：

```bash
# 阿里云短信服务
ALIYUN_SMS_ACCESS_KEY_ID="your-access-key-id"
ALIYUN_SMS_ACCESS_KEY_SECRET="your-access-key-secret"
ALIYUN_SMS_SIGN_NAME="短信签名名称"
ALIYUN_SMS_TEMPLATE_CODE="SMS_123456789"
```

### 参数说明

| 参数                           | 说明                        | 示例               |
| ------------------------------ | --------------------------- | ------------------ |
| `ALIYUN_SMS_ACCESS_KEY_ID`     | 阿里云访问密钥 ID           | `LTAI5tXXXXXXXX`   |
| `ALIYUN_SMS_ACCESS_KEY_SECRET` | 阿里云访问密钥 Secret       | `xxxxxxxxxxxxxxxx` |
| `ALIYUN_SMS_SIGN_NAME`         | 短信签名名称（需审核通过）  | `点心粤语`         |
| `ALIYUN_SMS_TEMPLATE_CODE`     | 短信模板 CODE（需审核通过） | `SMS_123456789`    |

## 短信模板要求

模板内容必须包含 `${code}` 变量，例如：

```
您的验证码是${code}，有效期10分钟，请勿泄露给他人。
```

## API 端点

### 发送验证码

- **POST** `/api/auth/send-sms-verification`
- **请求体**:
  ```json
  {
    "phoneNumber": "13800138000",
    "role": "learner"
  }
  ```
- **成功响应**:
  ```json
  {
    "success": true,
    "message": "验证码已发送",
    "phoneNumber": "138****8000"
  }
  ```
- **错误响应**:
  - `400` - 手机号格式不正确
  - `429` - 请求过于频繁（60 秒内重复请求）
  - `500` - 短信发送失败

### 验证码登录

使用 NextAuth 的 `signIn` 方法：

```javascript
import { signIn } from "next-auth/react";

const result = await signIn("sms", {
  phoneNumber: "13800138000",
  code: "123456",
  redirect: false,
});
```

## 手机号格式

系统只支持中国大陆手机号：

- 以 `1` 开头
- 第二位为 `3-9`
- 共 `11` 位数字

正则表达式：`/^1[3-9]\d{9}$/`

## 用户创建逻辑

```
用户输入手机号 → 发送验证码 → 用户输入验证码
                                    ↓
                          查询数据库是否存在该手机号
                                    ↓
              ┌─────────────────────┴─────────────────────┐
              ↓                                           ↓
         用户存在                                      用户不存在
              ↓                                           ↓
         直接登录                                    创建新用户
                                                    (默认角色: LEARNER)
                                                         ↓
                                                      登录成功
```

## 相关文件

### 核心文件

- `lib/services/aliyun-sms.ts` - 阿里云短信服务封装
- `providers/sms-provider.ts` - NextAuth SMS 认证 Provider
- `app/api/auth/send-sms-verification/route.ts` - 发送验证码 API
- `lib/auth.ts` - NextAuth 配置（包含 SMS Provider）

### 前端组件

- `components/dialogs/sms-login-dialog.tsx` - 短信登录对话框
- `components/dialogs/login-dialog.tsx` - 主登录对话框（包含短信登录入口）

### API Hooks

- `lib/api/auth.ts` - `useSendSmsVerificationCode` hook

## 常见问题

### Q1: 短信发送失败怎么办？

检查以下配置：

1. AccessKey 是否正确
2. 短信签名是否审核通过
3. 短信模板是否审核通过
4. 账户余额是否充足

### Q2: 验证码总是失败？

1. 检查验证码是否在 10 分钟内
2. 确认输入的手机号与接收短信的手机号一致
3. 验证码只能使用一次，使用后即失效

### Q3: 如何修改验证码有效期？

在 `app/api/auth/send-sms-verification/route.ts` 中修改：

```typescript
const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 修改这里的分钟数
```

## 阿里云短信服务配置指南

### 1. 创建签名

1. 登录 [阿里云短信服务控制台](https://dysms.console.aliyun.com/)
2. 进入「国内消息」→「签名管理」
3. 点击「添加签名」
4. 填写签名名称、适用场景等信息
5. 等待审核（通常 1-2 个工作日）

### 2. 创建模板

1. 进入「模板管理」→「添加模板」
2. 模板类型选择「验证码」
3. 模板内容填写：`您的验证码是${code}，有效期10分钟。`
4. 等待审核

### 3. 获取 AccessKey

1. 登录 [阿里云 AccessKey 管理](https://ram.console.aliyun.com/manage/ak)
2. 建议创建 RAM 子用户，仅授予短信服务权限
3. 创建 AccessKey 并保存

## 更新日志

- **2026-01-06**: 添加手机号绑定、冲突处理、账号注销功能
- **2026-01-05**: 初始版本，支持阿里云短信验证码登录

---

# 手机号绑定与账号注销功能

## 功能概述

| 功能       | 说明                             |
| ---------- | -------------------------------- |
| 手机号绑定 | 允许微信/邮箱用户绑定手机号      |
| 冲突处理   | 检测并提示手机号已被其他账号使用 |
| 账号注销   | 7 天冷静期，期间可撤销           |

---

## 手机号绑定

### 1.1 功能说明

允许通过微信或邮箱注册的用户绑定手机号，绑定后可使用手机号登录该账号。

### 1.2 业务流程

```
已登录用户 → 进入账户设置 → 点击"绑定手机号"
                                ↓
                        输入手机号 → 发送验证码
                                ↓
                        输入验证码 → 验证成功
                                ↓
                ┌───────────────┴───────────────┐
                ↓                               ↓
         手机号未被使用                    手机号已被其他账号使用
                ↓                               ↓
           绑定成功                        显示冲突提示
                                           (见 Phase 2)
```

### 1.3 API 设计

#### 发送绑定验证码

```
POST /api/user/phone/send-bind-code
Authorization: Bearer <token>

Request:
{
  "phoneNumber": "13800138000"
}

Response (200):
{
  "success": true,
  "message": "验证码已发送"
}

Response (409 - 冲突):
{
  "error": "PHONE_ALREADY_BOUND",
  "message": "该手机号已被其他账号使用"
}
```

#### 绑定手机号

```
POST /api/user/phone/bind
Authorization: Bearer <token>

Request:
{
  "phoneNumber": "13800138000",
  "code": "123456"
}

Response (200):
{
  "success": true,
  "message": "手机号绑定成功"
}
```

### 1.4 安全措施

| 措施           | 说明                       |
| -------------- | -------------------------- |
| **身份验证**   | 必须登录状态才能绑定       |
| **验证码校验** | 绑定前需验证手机验证码     |
| **频率限制**   | 60 秒内不可重复发送        |
| **唯一性约束** | 一个手机号只能绑定一个账号 |

### 1.5 文件清单

| 文件                                         | 说明                     |
| -------------------------------------------- | ------------------------ |
| `app/api/user/phone/send-bind-code/route.ts` | 发送绑定验证码 API       |
| `app/api/user/phone/bind/route.ts`           | 绑定手机号 API           |
| `components/dialogs/bind-phone-dialog.tsx`   | 绑定手机号对话框         |
| `app/(account)/account/profile/page.tsx`     | 账户设置页面（添加入口） |

---

## 手机号冲突处理

### 2.1 冲突场景

当用户尝试绑定的手机号已被其他账号使用时触发。

### 2.2 处理策略

**推荐方案：拒绝绑定 + 引导处理**

```
检测到冲突 → 显示提示对话框
              ↓
      "该手机号已被其他账号使用"
              ↓
         提供选项：
         ├─ [使用该手机号登录] → 退出当前账号，使用手机号登录
         └─ [注销旧账号] → 跳转到旧账号注销流程（需先登录旧账号）
```

### 2.3 UI 提示

```tsx
// 冲突提示对话框内容
<Dialog>
  <DialogTitle>手机号已被使用</DialogTitle>
  <DialogDescription>
    该手机号 138****8000 已关联其他账号。 您可以选择：
  </DialogDescription>
  <DialogFooter>
    <Button onClick={loginWithPhone}>使用该手机号登录</Button>
    <Button variant="outline" onClick={close}>
      取消
    </Button>
  </DialogFooter>
</Dialog>
```

---

## 账号注销

### 3.1 功能说明

用户可以申请注销账号，设置 **7 天冷静期**，期间可撤销。

### 3.2 业务流程

```
用户申请注销 → 验证身份（发送验证码）
                    ↓
              确认注销意愿
                    ↓
         账号状态变为 PENDING_DELETE
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
   7天内登录                   7天后
        ↓                       ↓
   可撤销注销              系统执行删除
        ↓                       ↓
   恢复正常状态            清除用户数据
                          释放手机号/邮箱
```

### 3.3 数据库模型

```prisma
model User {
  // ... 现有字段

  // 账号状态
  status            UserStatus @default(ACTIVE)
  deletionRequestedAt DateTime?  // 注销申请时间
}

enum UserStatus {
  ACTIVE           // 正常
  PENDING_DELETE   // 待注销（冷静期）
  DELETED          // 已注销
}
```

### 3.4 API 设计

#### 申请注销

```
POST /api/user/account/request-deletion
Authorization: Bearer <token>

Request:
{
  "verificationCode": "123456",  // 通过已绑定手机/邮箱验证
  "confirmPhrase": "确认注销"    // 用户输入确认短语
}

Response (200):
{
  "success": true,
  "message": "注销申请已提交",
  "deletionDate": "2026-01-12T00:00:00Z"  // 7天后
}
```

#### 撤销注销

```
POST /api/user/account/cancel-deletion
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "message": "注销申请已撤销"
}
```

### 3.5 数据处理策略

| 阶段         | 处理内容                                      |
| ------------ | --------------------------------------------- |
| **立即执行** | 登出所有设备、标记状态为待删除                |
| **冷静期内** | 限制登录提示"账号待注销"、允许撤销            |
| **冷静期后** | 清除个人信息、匿名化业务数据、释放手机号/邮箱 |

### 3.6 需保留数据（法规要求）

- 交易/充值记录（匿名化保留）
- 操作日志（保留 6 个月）
- 语料标注历史（保留贡献，移除个人信息）

### 3.7 文件清单

| 文件                                             | 说明                           |
| ------------------------------------------------ | ------------------------------ |
| `prisma/schema.prisma`                           | 添加 UserStatus 枚举和状态字段 |
| `app/api/user/account/request-deletion/route.ts` | 申请注销 API                   |
| `app/api/user/account/cancel-deletion/route.ts`  | 撤销注销 API                   |
| `components/dialogs/delete-account-dialog.tsx`   | 注销确认对话框                 |
| `scripts/process-deletions.ts`                   | 手动清理脚本：处理到期注销     |

### 运维脚本

```bash
# 预览待清理账号
pnpm process-deletions --dry-run

# 执行清理
pnpm process-deletions
```

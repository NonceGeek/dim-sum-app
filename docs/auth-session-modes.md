# NextAuth.js Session 模式切换指南

本项目使用 NextAuth.js 
其中有两种 session 策略：JWT 模式和数据库模式。

## 概述

NextAuth.js 支持两种 session 管理策略：
- **JWT 模式**：session 信息存储在客户端的 JWT token 中
- **数据库模式**：session 信息存储在数据库的 Session 表中

## 两种模式对比

### JWT 模式 (当前使用)

#### 工作原理
```typescript
// 配置
session: {
  strategy: "jwt"
}

// 验证流程
1. 从 cookie 读取 JWT token
2. 使用 NEXTAUTH_SECRET 验证签名
3. 解码 token 获取用户信息 (无数据库查询)
4. 返回 session
```

#### 优点
- **性能优秀**：无需每次请求都查询数据库
- **扩展性强**：多服务器间无需共享 session 存储
- **无状态设计**：服务器不需要维护 session 状态
- **离线验证**：只要有密钥就能验证，适合微服务架构

#### 缺点
- **无法主动失效**：token 签发后在过期前无法撤销
- **敏感信息风险**：token 可被解码查看用户信息
- **token 体积大**：包含用户信息，每次请求都传输
- **难以审计**：无法追踪用户活跃状态

### 数据库模式

#### 工作原理
```typescript
// 配置
session: {
  strategy: "database"
}

// 验证流程
1. 从 cookie 读取加密的 sessionToken
2. 使用 NEXTAUTH_SECRET 解密获得明文 sessionToken
3. 用 sessionToken 查询数据库获取用户信息
4. 返回 session
```

#### 优点
- **完全可控**：可随时删除 session 实现强制登出
- **安全性高**：只存储 session ID，用户信息在服务器端
- **完整审计**：能追踪用户登录历史和活跃状态
- **灵活管理**：可限制同时登录设备数量
- **即时生效**：用户权限变更可立即反映

#### 缺点
- **性能开销**：每次请求都需要数据库查询
- **扩展性限制**：多服务器需要共享数据库
- **复杂度增加**：需要处理 session 清理、续期等逻辑
- **依赖数据库**：数据库不可用会影响认证

## Session Token 存储详解

### JWT 模式
```typescript
// Cookie 中存储的是签名的 JWT
cookie: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."

// JWT 包含用户信息并用 NEXTAUTH_SECRET 签名
const decoded = jwt.verify(token, NEXTAUTH_SECRET);
// { id: "user_123", role: "TAGGER_PARTNER", ... }
```

### 数据库模式
```typescript
// 1. 生成随机 sessionToken (明文)
const sessionToken = "clx123abc456def789";

// 2. 存储到数据库 (明文)
await prisma.session.create({
  data: {
    sessionToken: "clx123abc456def789", // 明文存储
    userId: "user_123",
    expires: new Date(...)
  }
});

// 3. 加密后存储到 cookie
const encryptedCookie = encrypt(sessionToken, NEXTAUTH_SECRET);
// Cookie: "encrypted_xyz_value"
```

## 切换到数据库模式

### 1. 修改配置

```typescript
// lib/auth.ts
export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database", // 改为 database
    maxAge: 30 * 24 * 60 * 60, // 30天
    updateAge: 24 * 60 * 60,    // 每天更新一次
  },
  // ...
}
```

### 2. 删除 JWT Callback

```typescript
// 删除整个 jwt callback，因为它不会被调用
// async jwt({ token, user, account, profile }) { ... }
```

### 3. 修改 Session Callback

```typescript
// 从
async session({ session, token }) {
  session.user.id = token.id;
  session.user.role = token.role;
  // ...
}

// 改为
async session({ session, user }) {  // token → user
  session.user.id = user.id;
  session.user.role = user.role;
  session.user.image = user.image || user.wechatAvatar;
  // user 参数直接来自数据库查询结果
}
```

### 4. 保留 SignIn Callback

```typescript
// signIn callback 保持不变，继续处理微信登录逻辑
async signIn({ account, profile, user }) {
  if (account?.provider === 'wechat' && profile) {
    // 现有的微信用户创建/更新逻辑保持不变
    // PrismaAdapter 会自动创建 Session 记录
  }
  return true;
}
```

## 重要注意事项

### 1. NEXTAUTH_SECRET 仍然必需
无论哪种模式，`NEXTAUTH_SECRET` 都是必需的：
- **JWT 模式**：用于签名 JWT
- **数据库模式**：用于加密 cookie + CSRF 保护

### 2. Session 自动管理
数据库模式下，`PrismaAdapter` 会自动处理：
- ✅ 创建 Session 记录
- ✅ 更新 Session 过期时间  
- ✅ 删除过期 Session
- ✅ 登出时删除 Session

### 3. 性能考虑
每个受保护的 API 调用都会触发数据库查询：
```sql
SELECT s.*, u.id, u.role, u.name, u.email 
FROM Session s 
JOIN User u ON s.userId = u.id 
WHERE s.sessionToken = ? 
AND s.expires > NOW();
```

### 4. 微信信息获取
数据库模式下，如需 openId/unionId：
```typescript
async session({ session, user }) {
  // 可选：额外查询微信 Account 信息
  const wechatAccount = await prisma.account.findFirst({
    where: { userId: user.id, provider: 'wechat' },
    select: { openId: true, unionId: true }
  });
  
  if (wechatAccount) {
    session.user.openId = wechatAccount.openId;
    session.user.unionId = wechatAccount.unionId;
  }
}
```

## 应用场景建议

### 选择 JWT 模式
- API 服务、微服务架构
- 对性能要求高的应用
- 用户权限变化不频繁
- 短期 token（如几小时）

### 选择数据库模式  
- 需要严格权限控制的企业应用
- 需要审计日志的系统
- 用户角色经常变化
- 需要强制下线功能

### 混合方案
考虑根据用户角色使用不同策略：
- 普通用户（LEARNER）：JWT 模式
- 特权用户（TAGGER_*、RESEARCHER）：数据库模式

## 管理功能示例

### 强制用户下线
```typescript
// 删除用户所有 session
await prisma.session.deleteMany({
  where: { userId: "user_123" }
});
```

### 查看活跃用户
```typescript
const activeSessions = await prisma.session.findMany({
  where: { expires: { gt: new Date() } },
  include: { user: { select: { id: true, name: true, role: true } } }
});
```

### 限制同时登录
```typescript
const userSessions = await prisma.session.count({
  where: { userId: "user_123" }
});

if (userSessions >= 3) {
  // 删除最旧的 session
  const oldestSession = await prisma.session.findFirst({
    where: { userId: "user_123" },
    orderBy: { expires: 'asc' }
  });
  await prisma.session.delete({
    where: { id: oldestSession.id }
  });
}
```
# 小程序手机号登录/注册 与 账号合并

> 记录时间：2026-07-01
> 范围：小程序手机号登录改为「登录即注册」，以及由此引入的「手机号被占用 → 确认后合并账号（可回溯）」能力。

---

## 1. 背景与需求

小程序原本的手机号登录**只登录、不注册**：验证码校验通过后，按 `phoneNumber` 查用户，查不到直接返回 404「用户不存在，请先通过 Web 端注册或使用微信登录」。注册只能走 Web 端。

产品希望手机号支持**自由注册**：

- 手机号已注册 → 直接登录；
- 手机号已被某账号绑定 → 登录那个账号；
- 都没有 → 新建账号后登录。

由此引出的核心风险与决策见下。

---

## 2. 关键决策记录

### 2.1 为什么原来只做登录

不是遗漏，而是有意为之：本系统是**带权限的专业工具**，不是可随意注册的 C 端产品。

- 用户是被授权才能用：登录返回 `allowedCorpora`，User 有 `role` / `isSystemAdmin` / 语料权限体系。自助建号会产生「无角色、无权限」的空壳账号。
- 账号体系要统一去重：一个人可能有微信 unionId、手机号、邮箱多种标识，注册口子分散容易产生重复用户。
- 收敛注册入口降低风险：短信验证码可被刷，只留 Web 一个注册入口更可控。

### 2.2 「已注册」与「已被绑定」是同一回事

Web 端绑定手机号就是往 `user.phoneNumber` 写值。所以无论手机号是「手机注册产生的」还是「微信用户绑定的」，都落在同一个 `phoneNumber` 字段上。于是登录逻辑收敛为：

1. `findFirst({ where: { phoneNumber } })` 命中 → 登录（自动涵盖上面前两种情况）；
2. 未命中 → 新建（默认 LEARNER）后登录。

### 2.3 会不会和已有微信账号产生重复用户？—— 会

微信注册（`lib/auth.ts` signIn）建 User 时**只写 `wechatAvatar` + `Account(wechat)`，不写 `phoneNumber`**。微信用户的手机号只有在 Web 端主动绑定后才有值。

因此存在重复场景：微信用户从没绑过手机（`phoneNumber = null`）→ 又用手机号自由注册 → 按 `phoneNumber` 查不到 → 建了第二个账号。

**根因**：微信的 `jscode2session` 只给 `openid/unionid`，不给手机号，两个标识没有共同字段，无法在注册时对上。

### 2.4 应对策略

- 给 `phoneNumber` 加 `@unique`，兜底并发/异常重复（Postgres 允许多个 `NULL`，大量没绑手机的微信用户不受影响）。
- 对「微信用户从没绑手机」这个残留边界：**接受**它先产生独立账号，随后当该微信用户在 Web 端绑定手机时，若发现手机号已被自由注册账号占用 → **合并**两个账号（见第 4 节）。

### 2.5 合并必须显式确认，且可回溯

- 合并是账号级不可逆操作，**不能静默执行**，必须二次确认（见 4.1）。
- 冲突的旧数据要 **0 丢失**：采用**快照归档 + 软删除**，源账号不物理删除，为将来「撤回合并」保留可能（撤回接口本身暂缓，见第 7 节）。

---

## 3. 数据模型变更（`prisma/schema.prisma`）

| 变更 | 说明 |
|---|---|
| `User.phoneNumber` 加 `@unique` | 手机号唯一，兜底重复。上线前已确认无重复非空手机号（当时 165 用户 / 60 有手机 / 0 重复）。 |
| `UserStatus` 新增 `MERGED` | 源账号被合并后的软删除状态。 |
| `User.mergedIntoId String?` | 指向合并去向（survivor）账号 id。 |
| 新增 `model user_merge_logs` | 合并归档表：存合并前快照 + 映射，供回溯/撤回。 |

`user_merge_logs` 结构：

```prisma
model user_merge_logs {
  id             String    @id @default(cuid())
  source_user_id String
  target_user_id String
  phone_number   String?   // 被合并过来的手机号（源账号原手机号）
  snapshot       Json      // 合并前源账号全部数据 + 会被改动的目标行
  status         String    @default("MERGED") // MERGED | REVERSED
  created_at     DateTime  @default(now()) @db.Timestamptz(6)
  reversed_at    DateTime? @db.Timestamptz(6)

  @@index([source_user_id])
  @@index([target_user_id])
}
```

> ⚠️ **需要执行迁移**：`pnpm db:push`（或 `pnpm db:migrate`）以应用上述 schema。

---

## 4. 流程说明

### 4.1 手机号登录 / 自由注册

接口：`POST /api/miniprogram/auth/login`（`handlePhoneLogin`）

1. 格式化并校验手机号；
2. 校验短信验证码（`verificationToken`，未过期）；
3. 按 `phoneNumber` 查用户 —— **命中即登录**（涵盖「已注册」与「已被微信账号绑定」）；
4. **未命中则自由注册**：事务内新建 User（默认 LEARNER，默认名 `用户_随机6位`，不使用手机号后四位以免泄露）+ 创建 `Account(provider=sms)`；并发撞唯一约束时回读已存在用户兜底；
5. 删除已用验证码，签发 token。

> 微信登录 `handleWeChatLogin` **保持不变**，仍是「按 unionId 查不到就 404」。本次「自由注册」只作用于手机号路径。

### 4.2 微信用户绑定手机号 → 冲突时确认合并

涉及接口：`send-bind-code` / `bind`；前端：`bind-phone-dialog.tsx`。

二次确认流程：

1. **发码** `POST /api/user/phone/send-bind-code`
   - 不再因「号码被别人占用」拦截（已移除旧的 `PHONE_ALREADY_BOUND` 409），正常发码。用户需先用短信证明拥有该号码。
2. **验码绑定** `POST /api/user/phone/bind`
   - 验证码通过后，若号码属于另一账号且**未带 `confirmMerge`** → 返回 `409 { error: "MERGE_REQUIRED" }`，且**不消费验证码**（留给确认步骤复用）。
3. **弹窗确认**（前端进入 `merge-confirm` 步骤）
   - 明确告知：重合数据（点赞/收藏/权限/游戏进度）保留当前账号版本、其余合并进来、**nothing is lost**，原账号将被停用（已归档、可由管理员恢复）。
4. **确认合并**
   - 用同一验证码带 `confirmMerge: true` 再次提交 → 执行合并。

### 4.3 合并内部三阶段（`lib/user-merge.ts` · `mergeUserRelations`）

在单个事务内完成（bind 路由设置事务 `timeout: 30000`）：

- **Phase A · 合并前快照（0 丢失关键）**
  读取源账号名下所有表的行 + 会被改动的目标行原值（互动 / 权限 / 游戏进度），打成 JSON 存进 `user_merge_logs.snapshot`。`sessions` / `walletNonces` 属临时数据不快照。BigInt/Date 用 `toJsonSafe` 转纯 JSON。
- **Phase B · 字段级合并（冲突 0 丢失）** —— 见第 5 节策略。
- **Phase C · 软删除源账号 + 写归档**
  源 User 置 `status=MERGED`、`mergedIntoId=target`、`phoneNumber=null`（释放唯一约束，原值已入快照），**保留整行**；写入 `user_merge_logs`。

bind 路由随后把手机号落到 target、确保 target 有 SMS Account、删除验证码。

---

## 5. 合并的字段级策略（逐表）

对存在「用户维度唯一约束」的表做字段级合并，而非删除源数据：

| 表 | 唯一约束 | 冲突处理（0 丢失） |
|---|---|---|
| `user_corpus_interactions` | `[user_id, corpus_unique_id]` | 布尔标记 `is_liked/is_bookmarked/is_viewed` 取**并集(OR)**，`category` 补空；无冲突整行 repoint |
| `user_corpus_permissions` | `[user_id, category_name]` | 取**更高权限**（`READ<WRITE<CREATE<FULL`）；无冲突整行 repoint |
| `corpus_collection_likes` | `[submission_id, user_id]` | 去重后点赞仍在（无丢失），并按 `count()` **重算 `like_count`**；无冲突整行 repoint |
| `game_player_progress` | `user_id` 主键（一对一） | 计数字段**取和**、连续天数**取大**、最后游玩日**取晚**、正确率 = `correct/graded` 重算、level 取更高档；只有一方有则整行 repoint |

无冲突的外键（`account` / `api_key` / `game_answer_records` / `corpus_collection_submissions`(含 `reviewed_by`) / `corpus_collection_comments` / `corpus_collection_messages` / `cantonese_corpus_update_history`(含 `contributor_user_id`) / `corpus_collection_activities.created_by` / `corpus_collection_review_batches.created_by` / `corpus_category.assigned_by` / `corpus_tags.created_by` / `permission_audit_logs.operator_id`+`target_user_id`）：直接 `updateMany` repoint。

`session` / `walletNonce`：直接删除（临时数据，撤回后重登即可再生）。

---

## 6. 后台查询过滤 MERGED 账号

软删除的源账号（`status=MERGED`）不应出现在用户列表/统计中。已用 `status: { not: "MERGED" }` 过滤（保留原本对 `PENDING_DELETE` 等状态的包含行为）：

| 文件 | 改动 |
|---|---|
| `app/api/admin/users/route.ts` | 用户列表 + 计数排除 MERGED |
| `app/api/admin/stats/route.ts` | 总用户数排除 MERGED |
| `app/api/admin/corpus/permissions/route.ts` | 禁止给已合并账号分配权限 |

**未改动**（已天然排除或不适用）：

- `data-annotation/tasks/users`、`data-annotation/tasks/stats`、`miniprogram/users/public` —— 本就 `status: "ACTIVE"`，已排除 MERGED。
- `miniprogram/task/stats` —— 是按 id 反查姓名/头像做展示补全，历史任务里若含该用户仍需显示名字，故**保留**。

其余合并后靠「手机号置空 + 账号已 repoint」，源账号已无法通过任何 provider 登录。

---

## 7. 涉及文件清单

**后端**

- `app/api/miniprogram/auth/login/route.ts` —— 手机登录改为登录即注册；默认名随机后缀
- `app/api/user/phone/bind/route.ts` —— `confirmMerge` 门控 + 事务合并（`timeout: 30000`）
- `app/api/user/phone/send-bind-code/route.ts` —— 移除占用拦截，放行发码
- `lib/user-merge.ts` —— **新增** `mergeUserRelations`（快照 + 字段级合并 + 软删除 + 归档）
- `app/api/admin/users/route.ts`、`app/api/admin/stats/route.ts`、`app/api/admin/corpus/permissions/route.ts` —— 过滤 MERGED

**前端**

- `lib/api/user.ts` —— `bindPhone` / `useBindPhone` 透传 `confirmMerge`
- `components/dialogs/bind-phone-dialog.tsx` —— `merge-confirm` 步骤 + 零丢失/归档文案

**Schema**

- `prisma/schema.prisma` —— `phoneNumber @unique`、`UserStatus.MERGED`、`User.mergedIntoId`、`model user_merge_logs`

---

## 8. 部署 / 验证

- **迁移**：`pnpm db:push`（本轮新增 `user_merge_logs` 表、`MERGED`、`mergedIntoId`，需应用）。
- **验证状态**：`prisma generate` 通过；所有改动文件 `tsc --noEmit` clean；DB 检查 0 重复手机号，唯一索引安全。

---

## 9. 待办 / 搁置项

- **撤回合并 API（暂缓）**：数据已齐备。实现思路 —— 读 `user_merge_logs.snapshot` → 按快照 id 把 repoint 的行移回源账号 / 重建被去重删除的冲突行 / 还原 `target_before` 目标行原值 / 源账号 `status` 恢复 `ACTIVE` 并还原手机号 / 日志 `status=REVERSED`。
- MERGED 用户如需在特定后台界面「可见但标记」，可再单独加带状态标识的查询。

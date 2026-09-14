# 服务号关注者自动绑定与 agent 推送

## 目标与现状

用户不再手工提供 OpenID。后端接收服务号关注事件，保存服务号 OpenID，通过 UnionID 关联平台账号，并维护 `Account.openIdWxService`，供 agent 继续直接读取数据库推送。

已核对 `main/lib/services/agent.ts`：小程序任务接口对接 `AGENT_API_BASE_URL` 下的 `GET /tasks`、`GET /tasks/:id`、`POST /tasks/:id/view`、`POST /tasks/:id/complete`、`POST /tasks/:id/skip-and-reassign`、`GET /tasks/stats`；身份参数使用平台 `userId`（actorRef/assigneeRef）。这些代理接口不包含服务号收件人注册接口。agent 直接读数据库的方式由业务方确认，当前仓库不包含 agent 的收件人查询源码，尚未做跨服务联调。

## 官方文档核对（2026-09-13）

旧版 `/doc/offiaccount/` 地址出现重定向，有的落到相邻主题或汇总页。网页读取工具报不可打开；本地受限网络报 DNS 解析失败，使用获准的网络访问后成功读取新版官方页面。

- [关注/取消关注事件](https://developers.weixin.qq.com/doc/service/guide/product/message/Receiving_event_pushes.html)：`FromUserName` 是服务号 OpenID，`subscribe` / `unsubscribe` 表示关注和取消关注。
- [获取用户基本信息](https://developers.weixin.qq.com/doc/service/api/usermanage/userinfo/api_userinfo)：查询关注状态和 UnionID；只有满足开放平台绑定等条件时才返回 UnionID。
- [获取关注用户列表](https://developers.weixin.qq.com/doc/service/api/usermanage/userinfo/api_getfans)：每页最多 10000 个 OpenID，按 `next_openid` 翻页。
- [消息加解密](https://developers.weixin.qq.com/doc/service/guide/dev/push/encryption.html)：签名验证、AES-CBC 解密、AppID 校验；生产建议安全模式。

## 实现设计

1. 服务号与 Review App 绑定同一个微信开放平台账号。配置使用服务号自己的 AppID/Secret，不能使用小程序或网站登录应用的凭据。
2. `/api/public/wechat/service-account` 接收微信服务器校验与 XML 回调，验证签名；安全模式解密并验证 AppID。回调仅持久化关注状态，不等待微信用户信息网络请求。
3. 独立 `WechatServiceFollower` 表按 `(appId, openId)` 保存关注状态、UnionID、事件时间和待同步状态。允许先关注、后注册。
4. 同步脚本处理待同步记录，读取微信用户信息，以 UnionID 匹配 `provider=wechat` 的 Account。只有唯一的平台用户匹配、且不存在冲突时，回填 `openIdWxService`。不更改用户角色。
5. 小程序微信登录成功时再次尝试匹配已同步关注者，覆盖先关注后注册的顺序。绑定失败不阻断登录。
6. 取消关注时清空该 OpenID 对应的 `Account.openIdWxService`，让读取非空字段的 agent 停止选择该推送地址。
7. 历史关注者分页导入并同步；已有人工录入地址也纳入核对。失败不删除已有数据，保留待同步状态重试。事件版本检查防止较早的网络响应覆盖刚收到的取消关注。

当前兼容字段只能容纳一个服务号，因此此部署只配置一个服务号，不可同时运行多个 AppID 的同步任务。UnionID 缺失或存在账号冲突时保留记录，不猜测身份；一次性绑定码作为后续补充方案，不属于本次自动 UnionID 绑定实现。

## 推送边界

agent 仍按平台用户与角色分配任务，读取 `Account.openIdWxService`。上线前确认查询过滤空值、没有长期缓存旧 OpenID，且使用相同服务号 AppID。数据库存在 OpenID 不等于拥有任意主动发送权限；消息类型、模板、频控和授权条件由现有推送服务负责。

## 部署与验证

本次已实现后端回调、持久化关注者表、UnionID 自动绑定、取消关注清理、登录补绑定和 CLI 同步任务。初次本地实现时未部署、未修改生产数据库；后续生产迁移与发布记录见文末。微信后台配置和真实消息发送仍未执行。

### 环境变量

在 `main/.env.example` 中提供了以下变量；运行服务和同步任务须指向同一数据库及同一服务号。

| 变量 | 内容 |
| --- | --- |
| `WECHAT_SERVICE_APPID` | 服务号 AppID；与 agent 推送使用的 AppID 相同 |
| `WECHAT_SERVICE_SECRET` | 服务号 AppSecret，仅同步进程需要 |
| `WECHAT_SERVICE_ORIGINAL_ID` | 服务号原始 ID，形如 `gh_...`，用于核对消息接收者 |
| `WECHAT_SERVICE_CALLBACK_TOKEN` | 自定义回调校验 Token，与微信后台配置一致 |
| `WECHAT_SERVICE_ENCODING_AES_KEY` | 微信后台消息加解密密钥，43 字符 |
| `WECHAT_SERVICE_MESSAGE_MODE` | 默认 `aes`；明文模式需显式设置为 `plain` |

同步使用 [稳定 access_token 接口](https://developers.weixin.qq.com/doc/service/api/base/api_getstableaccesstoken.html)，始终 `force_refresh=false`，在进程内缓存。官方说明它与旧 `getAccessToken` 凭据互相隔离，避免另起同步进程刷新掉 agent 的旧接口凭据。仍须满足服务号接口权限、IP 白名单等平台配置；所有密钥只放服务端环境变量。

### 上线顺序

1. 部署前检查当前服务号是否已有消息回调 URL。本接口只处理关注/取消关注/扫码事件，其他消息返回 `success`；如果已有客服、自动回复或其他事件处理器，应先合并/分发事件，不能直接替换导致原功能丢失。微信后台选择 **XML** 格式。
2. 审核并应用新增迁移 `main/prisma/migrations/20260913090000_add_wechat_service_followers/migration.sql`。它只创建关注者表与索引。按项目现有发布流程执行迁移并 `pnpm db:generate`；不要对生产执行 `db push`，也不要未经核对就批量执行其他未应用迁移。
3. 部署 API，配置环境变量。微信后台回调 URL 为 `https://search.aidimsum.com/api/public/wechat/service-account`，配置对应 Token、EncodingAESKey 和安全模式。URL 验证是 GET，事件接收是 POST，不需要用户登录。
4. 在 `main` 目录先运行一次存量同步：

   ```sh
   pnpm sync:wechat-service --full
   ```

5. 在常驻后端/定时作业平台上，**每分钟**执行待同步处理：

   ```sh
   pnpm sync:wechat-service --pending
   ```

   每天另执行一次 `--full`，补偿错过的事件、后补的 UnionID 与账号关联。任务使用单实例调度，避免两次全量同步重叠；全量作业逐个请求用户信息，规模大时需要评估接口额度与作业时限。不应把整个全量同步塞进微信回调或短时限 HTTP 请求。
6. 用测试标注员实际关注服务号并登录 Review App，确认 `Account.openIdWxService` 自动出现，再检查 agent 的收件人查询。取消关注后字段应清空；再次关注并完成下一次同步后恢复。实际发送消息需在消息通道联调时另行执行。

配置定时作业后，新关注用户通常在下一个同步周期完成绑定；仅部署 API 而未启动作业，记录会停留在待同步状态。

### 结果与排查

同步命令只输出各结果计数，不输出 OpenID、Token 或 Secret：

- `bound`：已绑定，重复同步仍可返回此结果。
- `unmatched`：尚未找到平台账号，小程序后续微信登录会补绑定。
- `missing_unionid`：微信没有返回 UnionID，检查开放平台绑定，修正后跑 `--full`。
- `conflict`：一个 UnionID 对应多个平台用户、多个服务号关注者，或已有地址/归属冲突；保留原数据，人工核对后重新跑 `--full`。
- `unsubscribed`：已确认取消关注并清空兼容推送字段。
- `stale`：网络查询期间有更新的事件或同步提交，本次查询结果丢弃。
- `failed`：请求或数据库操作失败；保留/加入 `needsSync` 重试队列，进程返回非零状态。

`--full` 对现有关注者记录和人工录入地址都逐个向微信确认状态，不因分页列表缺少某人就直接取消绑定。若全量分页中断，命令失败退出，已入库部分保留，下次可重跑。

### 本地验证

```sh
cd main
pnpm db:generate
pnpm test:wechat-service
pnpm exec tsc --noEmit --incremental false
```

数据库集成用例默认跳过；只有显式提供 `WECHAT_TEST_DATABASE_URL` 才运行，绝不回退到业务 `DATABASE_URL`。请指向已初始化 Account/User 表和本次新增表的临时 PostgreSQL：

```sh
WECHAT_TEST_DATABASE_URL='postgresql://USER@127.0.0.1:PORT/TEST_DB' pnpm test:wechat-service
```

2026-09-13 已在隔离本地 PostgreSQL 中应用本次新增 SQL 迁移，并通过全部 8 个用例（无跳过），覆盖签名、AES 解密与 AppID 校验、令牌缓存/重试、分页、身份冲突、先关注后登录、取消关注、重复/乱序事件、网络失败及取消关注竞态。TypeScript 全量类型检查通过。尚未连接真实服务号进行端到端联调。


## 2026-09-13 生产迁移与发布执行记录

用户授权先进行 Git 提交、生产迁移与线上发布，再配置微信后台与定时任务。

- 发布基线：`origin/main` 的 `1d0ed87`；独立分支 `feat/wechat-service-binding`，功能提交 `3b9a7c1`。
- 发布入口：[PR #443](https://github.com/NonceGeek/dim-sum-app/pull/443)，通过 main 的 Vercel 自动部署流程发布；构建与合并状态以 PR 检查为准。
- 生产目标：与 Vercel `aid-im-sum-lab/dim-sum-app` Production 环境关联的数据库。
- 只读确认原 `Account.userId / unionId / openIdWxService` 字段存在，新关注者表不存在后，在事务中执行本次 SQL（5 秒锁超时、30 秒语句超时）。仅创建新表和三个索引；未执行所有历史待迁移项，也未修改用户或语料数据。
- 执行 `prisma migrate resolve --applied 20260913090000_add_wechat_service_followers` 登记本次迁移，复核表存在且迁移完成。
- 当前 Production 未配置 `WECHAT_SERVICE_*`，因此代码发布后回调应返回 HTTP 503“Service account callback is not configured”，不会提前启用绑定。
- 后续：配置开放平台绑定与微信回调、服务号环境变量、同步任务，完成真实账号和推送联调。

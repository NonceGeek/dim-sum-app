# 服务号关注者自动绑定与 agent 推送

## 当前状态与下一步（2026-09-15 更新）

最新明细统一维护在 [同步状态与异常明细](./wechat-sync-status.md)，本文件保留实现说明及历史部署记录。

- 开放平台绑定后，53 位当前关注者均已获取并保存 UnionID。
- 合并前全量结果：14 位绑定成功、34 位未匹配、5 位冲突、2 条历史地址失败。用户授权合并三组微信/短信账号后，随后两条旧地址已按用户授权替换并归档，最新复核为 19 位绑定成功、34 位未匹配、0 冲突、0 待重试。
- 已核实 5 条冲突原因：2 条账号旧地址无效，3 条正确地址被另一个用户的短信账号占用；两条失败正好是前两条冲突中的旧地址。
- ECS 每小时增量、每日北京时间 03:20 全量；回调实时处理。Vercel 三个环境配置、生产数据库迁移及定时器均已完成，不需要重复配置或迁移。
- 三组跨用户占用已通过事务合并解决，保留短信主用户的角色、历史数据和任务，微信/短信两种登录归到同一用户。需退出重新登录验收；两条无效旧地址也已修复，agent 推送联调仍待处理。执行快照和验收结果见最新明细，未发送消息。

### 绑定后首次验收（2026-09-15，北京时间；合并前历史记录）

- 用户截图确认此前服务号为“开放平台 0”，随后完成绑定，修正此前已绑定的判断。绑定后直接调用微信批量接口，53 位关注者全部返回非空 UnionID，API 无错误；此前缺失字段的原因已定位为服务号未绑定开放平台。
- 已手动执行 `run.sh full`：`bound=14, unmatched=34, conflict=5, failed=2`。存在失败，退出码为 1；不视为整轮全部成功，未发送微信消息。
- 同步完成后数据库复核：关注者 55 条、已关注 53 条、具有 UnionID 53 条、待同步 2 条、已匹配并保存服务号地址的关注者 14 位。
- 34 位未匹配表示没有找到相同 UnionID 的平台微信账号；5 位冲突保留原有绑定，未强行覆盖。2 条历史失败此前诊断为 40003，本轮未重新逐条诊断错误码。
- ECS 实际配置已核对：增量 `OnCalendar=*-*-* *:00:00`，附加最多 20 秒随机延迟；全量每天北京时间 03:20，附加最多 60 秒随机延迟。两项 timer 已启用，无需重复调整；关注、取关回调仍实时接收。
- 下一步：核对冲突和历史失败记录，完成先关注后登录、取关再关注回归，以及 agent 收件人、发送出口联调。上文及历史段落中的 UnionID 缺失待办已由本次验收解决。

## Git 发布约定

统一执行 `dev → PR → main`：先同步最新远程状态，在 `dev` 提交并推送，再提 `dev → main` PR；合并后将 `main` 快进同步回 `dev`，核验双方没有独有提交。

PR #443 曾从功能分支直接合入 `main`，不符合用户确认的流程。随后已通过 PR #445 修正发布约定并对齐远程分支；本地 `dev` 也在逐文件核对后完成安全同步，没有重复提交已发布代码。后续发布遵循本节约定。


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
- 发布入口：[PR #443](https://github.com/NonceGeek/dim-sum-app/pull/443)，已合并为 `a36a0ad`，Vercel 生产部署 Ready，并已核验正式域名回调响应。
- 生产目标：与 Vercel `aid-im-sum-lab/dim-sum-app` Production 环境关联的数据库。
- 只读确认原 `Account.userId / unionId / openIdWxService` 字段存在，新关注者表不存在后，在事务中执行本次 SQL（5 秒锁超时、30 秒语句超时）。仅创建新表和三个索引；未执行所有历史待迁移项，也未修改用户或语料数据。
- 执行 `prisma migrate resolve --applied 20260913090000_add_wechat_service_followers` 登记本次迁移，复核表存在且迁移完成。
- 截至 2026-09-13，Production 未配置 `WECHAT_SERVICE_*`，已验证发布后的回调返回 HTTP 503“Service account callback is not configured”，不会提前启用绑定。
- 后续：配置开放平台绑定与微信回调、服务号环境变量、同步任务，完成真实账号和推送联调。


## 2026-09-14 服务号配置进度

用户提供并确认服务号标识，按用户要求已写入 Vercel 项目 `aid-im-sum-lab/dim-sum-app` 的 **Production、Preview（所有分支）、Development** 三个环境：

| 变量 | 已保存值 |
| --- | --- |
| `WECHAT_SERVICE_APPID` | `wx6c2a6861fb6b945a` |
| `WECHAT_SERVICE_ORIGINAL_ID` | `gh_c7eabe456580` |
| `WECHAT_SERVICE_MESSAGE_MODE` | `aes` |

以上为标识和模式，不包含密钥。服务号 AppSecret、回调 Token 和 EncodingAESKey 现已覆盖这三个环境，生产重新部署已完成；本地使用前需拉取 Development 环境变量。

早前收集的配置项及仍需确认的信息：

- AppSecret 已由用户保存到 `WECHAT_SERVICE_SECRET`（三个环境），未输出到文档或聊天；尚未调用微信用户接口验证该 Secret。
- 用户打开了微信后台“启用消息推送”配置窗口，已将 Token/EncodingAESKey 保存到 Vercel 三个环境；用户已点击微信后台“确定”并确认验证成功。
- 服务号与 Review App 是否已绑定到同一个微信开放平台账号。
- 定时同步进程的服务器/作业平台及出口公网 IP，供配置数据库访问和微信接口白名单。

生产部署 `dpl_6tFwVnBhNQDoijAv6yvht5RnwAnq` 已 Ready，正式域名已切换。线上自检：签名 URL 校验 HTTP 200、AES URL 校验 HTTP 200、AES 消息解密 HTTP 200、错误签名拒绝 HTTP 403。AES 自检使用被忽略的文本消息，不创建关注者记录、不向微信用户发送消息。

微信后台“确定”验证已由用户确认成功。真实关注事件已验证入库，接下来确认执行环境/IP 白名单并开展首次同步与定时任务。此阶段未发送任何真实消息，也未再次执行生产迁移。


### 微信后台确认后的只读检查（2026-09-14）

- 用户已确认微信消息推送配置提交成功。
- 检查时该服务号的生产关注者记录为 0、待同步记录为 0，尚未验证真实关注事件；需测试微信号实际关注后再次核对。
- 调用微信 `stable_token`（`force_refresh=false`）返回 `40164`，提示当前检查进程出口 IP `112.48.31.200` 未加入白名单。尚未取得令牌，未拉取/写入历史关注者，也未验证 UnionID 返回情况。
- 当前 IP 属于本次本机检查路径，不代表 Vercel 或未来作业服务器。确定同步运行环境后，应将其实际出口 IP 加入微信白名单；若先在本机执行一次同步，需先允许本机当时的出口 IP。
- 阻碍解除前不执行首次全量同步。定时作业部署位置仍待提供；未向微信用户发送消息。


### 重新关注验证与 Vercel 同步方案（2026-09-14）

- 用户重新关注后，只读查询确认生产关注者记录 1 条、待同步 1 条。最新关注事件时间为北京时间 2026-09-14 17:01:47（UTC 09:01:47），`subscribed=true`、`needsSync=true`，尚无 UnionID。此前 0 条为重新关注前的检查结果。
- 真实回调接收及自动记录 OpenID 已验证；UnionID 获取、平台账号绑定、agent 推送仍待后续同步与联调，未发送真实消息。
- 同步可部署为 Vercel Cron + Node.js Function。目前只有 CLI 同步脚本，`main/vercel.json` 尚无 cron 配置。需增加鉴权（`CRON_SECRET`）、每轮数量/时间上限、持久化进度及防重叠执行，避免直接将全量循环放进一次函数调用。
- [Vercel Cron 官方限制](https://vercel.com/docs/cron-jobs/usage-and-pricing)：Hobby 最频繁每天一次；Pro/Enterprise 可每分钟运行。高频同步需相应计划。
- [Vercel Static IPs](https://vercel.com/docs/networking/static-ips) 支持 Pro/Enterprise；Pro 费用为每项目每月 100 美元，另计区域 Private Data Transfer。项目 Settings → Networking 配置后，由 Vercel 分配每个区域的一对固定出口 IP，应将实际调用微信接口的区域 IP 对全部加入微信白名单。配置覆盖项目各部署环境，不会让本地 Development 进程自动使用这些出口。
- 固定出口 IP 与网站域名的入站 IP 不同；此前 `112.48.31.200` 仅为本机检查出口。尚未启用或购买 Vercel Static IPs，也未部署 cron。
- 若不采用此付费功能，可在已有固定公网出口的服务器运行同步，或让 Vercel 经受鉴权保护的固定出口服务调用微信 API。下一步先确定出口方案，再完成同步部署、首次同步及绑定验收。


### Vercel 出口实测（2026-09-14）

- 用户提出历史维护者可能已配置 Vercel 白名单，因此直接验证云端请求，不能用此前本机 `40164` 推断 Vercel 状态。
- 正式代码没有获取服务号令牌的在线诊断入口；在同一项目创建了临时、带鉴权且限时有效的 Production 测试部署，区域与当前主要生产函数一致为 `hnd1`。仅调用 `stable_token`，`force_refresh=false`，不返回凭据或令牌、不发送消息、不修改数据库。
- 实测：`environment=production`、`region=hnd1`、微信 HTTP 200、业务错误码 `40164`、`tokenAcquired=false`；微信返回的未授权出口 IP 为 `52.196.74.186`。
- 结论仅覆盖本次同项目同区域测试部署的出口：该地址未获微信白名单授权。不能据此断言历史部署所有出口都未配置，也不能把此地址视为 Vercel 承诺的固定出口。可将其加入白名单后复测当前连通性，但长期运行仍需核实出口稳定性。
- 临时部署 `dpl_3DXE6z4EVJGuTWLxM31YCSNB73V2` 已删除。CLI 虽带 `--skip-domain`，仍短暂为测试部署分配项目默认 `dim-sum-app-aid-im-sum-lab.vercel.app` 别名；发现后立即恢复原部署。正式域名 `search.aidimsum.com` 检查仍指向 `dpl_6tFwVnBhNQDoijAv6yvht5RnwAnq`，全部原别名已确认恢复/保留。


### 现有 ECS 同步/中转条件检查（2026-09-14）

通过阿里云 Workbench 旧版远程终端，以 root 执行只读检查，未部署程序、未重启或修改现有服务。

- 实例：`launch-advisor-20250228`，广州，控制台公网 IP `8.148.224.114`，4 核/16 GiB，Ubuntu 24.04。
- 18:09 CST 实测：负载 0.06/0.10/0.09，可用内存约 11 GiB；根盘 295G、已用 208G、剩余 76G（74%）。有容量运行轻量同步任务。
- 运行环境：Node.js v23.10.0，pnpm/npm、Docker、Python3 已安装，cron active。部署时使用独立目录与运行环境，不替换现有 Node 或占用其他应用端口。
- 已有工作负载：多个 Python/Gunicorn/Node 进程；Docker 中 bw-backend（3000 端口）和 nps 正在运行。Nginx active，80/443 已监听；Fail2ban active，UFW active，UFW 包含 22/80/443 放行规则。尚未核实阿里云安全组和 Fail2ban 封禁名单。
- 微信 HTTPS 直连返回 HTTP 200、业务错误 41002（无凭据探测：appid missing），证明可访问接口，不代表 AppSecret/白名单验证成功。
- 对本地项目配置的 Supabase 新加坡连接池入口，5432/6543 TCP 均连接成功；未传输数据库凭据、未进行数据库认证，也未核对该本地入口与最新 Production 配置是否一致。
- ipify 出口查询连接失败，实际 NAT 出口 IP 尚未独立验证；不能直接将控制台公网 IP 等同于已实测微信出口。
- 判断：具备部署同步任务的资源与基本网络条件，优先独立 worker + 定时执行，不需要新增公网入站端口。中转服务亦具备基础条件，但尚需独立监听端口、Nginx HTTPS 路由、鉴权及公网入口联调。
- 上线前仍需：确认实际微信出口并配置白名单、以生产凭据验证 token/数据库认证、安装独立 worker 与防重叠定时任务、执行首次同步及绑定验收。现有浏览器终端偶发不响应，不应将未返回结果的命令视为完成。


### ECS 部署准备进度（2026-09-14）

用户已同意继续实施 ECS 同步。新增 `main/deploy/wechat-sync/` 独立部署材料：Dockerfile、锁定依赖、无凭据源码打包器、数据库/微信只读预检、统一执行锁、每小时增量及每日北京时间 03:20 全量的 systemd 定时器和安装说明。

本地包 `/tmp/dimsum-wechat-sync.tar.gz` 已生成；shell/JS 语法与 diff 检查通过；微信测试 7 通过、数据库集成测试 1 跳过（未配置测试库）。容器尚未构建验证。

本轮 Workbench 会话持续不响应，打开新终端后明确显示“与远程主机的连接已经断开”。当前阻碍为远程连接，不是用户未授权。尚未传输 Production 凭据，未安装 ECS worker，未启用定时器、未执行首次同步。本地部署材料尚未 Git 提交；后续代码仍按 dev → PR → main 流程交付。


### ECS 同步部署与首次执行结果（2026-09-14 18:28 CST）

- SSH 已恢复：仅解除本机出口 IP 的 Fail2ban 封禁，将用户提供私钥的权限收紧为 600，并备份、追加对应公钥至 root authorized_keys；未关闭 Fail2ban、未替换原有公钥、未重启现有应用。
- 实测 ECS 出口为 `8.148.224.114`。管理员添加微信白名单后，容器验证数据库认证成功、微信 stable_token 成功；白名单只填写 IP，不填写端口。
- worker 已安装至 `/opt/dimsum-wechat-sync`。Docker Hub/npm 官方源不可达，使用现有阿里云基础镜像与 `Dockerfile.ecs` 构建独立 Node 22.22.1 容器；构建、Prisma 生成及实际运行通过。
- 仅将生产数据库连接和服务号 AppID/AppSecret 写入 `/etc/dimsum-wechat-sync/worker.env`（root、600）。本机临时生产凭据已删除；仓库部署包不含凭据。未新增公网监听端口、未重复执行数据库迁移。
- 首次增量：`missing_unionid=1`。首次全量：`missing_unionid=53, failed=2`。失败两条重试仍失败，进一步只读检查均为微信 `40003`（无效 OpenID）。未擅自删除或清空历史地址，保留待同步队列，因此后续任务可能继续以失败状态退出，需核对这些旧地址。
- 同步后汇总：关注者表 55 条、已关注 53 条、具有 UnionID 的记录 0 条、待同步 2 条。接口成功不等于平台绑定成功，需管理员确认服务号与 Review App 关联同一微信开放平台，再复跑全量同步。
- systemd 配置验证通过，两项 timer 已 enabled/active：每小时增量、每天北京时间 03:20 全量，加入随机延迟，两个任务共享 flock 锁。容器限制 512 MiB/0.5 CPU，任务超时 2 小时。
- 本次已验证容器手动执行；定时器的后续自动执行可通过 `systemctl list-timers 'dimsum-wechat-sync-*'` 和 `journalctl -u 'dimsum-wechat-sync@*'` 查看。无效地址尚未修复，不把首次全量报告为全部成功。
- 仍待：开放平台/UnionID 配置、两条无效历史地址核对、真实账号绑定/取关回归、agent 数据库收件人及微信发送出口联调。ECS worker 只同步关注者，不自动改变 agent 的发送出口；本次未发送任何微信消息。

部署操作与暂停方式见 [ECS worker 安装说明](../../../../main/deploy/wechat-sync/README.md)。


### 同步频率调整与 UnionID 复核（2026-09-14 18:31 CST）

- 按用户要求，将最初每五分钟增量改为每小时整点执行（附加 0–20 秒随机延迟）；每日北京时间 03:20 全量不变。本文的当前频率统一更新为每小时。
- ECS timer 已重新加载并重启，配置验证通过；当次查询下一次增量为 19:00:14 CST。无需重建容器或重新部署 Vercel。
- 用户明确确认服务号与标注小程序已在同一个微信开放平台下，此项不再列为待用户确认；尚需排查其实际接口返回情况。
- 直接调用微信原始接口确认服务号 AppID 为 `wx6c2a6861fb6b945a`，关注者总数为 53。抽查 3 条已关注用户资料，API 无错误，但 JSON 均没有 `unionid` 字段；排除这些响应中的字段被 Zod 解析或入库时丢弃。未输出用户标识或凭据。
- 目前无法仅凭接口结果确定缺失原因，不能据此认定用户没有绑定开放平台。后续需结合开放平台实际绑定状态/生效时间、具体服务号 AppID 及微信接口支持排查。
- 关注/取消关注回调仍实时处理；新关注者补充资料与账号匹配可能等待至下一轮小时同步。此前同步成功但无 UnionID 的记录由每日全量再次核对。


### UnionID 全量只读排查（2026-09-14 18:40 CST）

- 已成功通过 HTTPS 读取微信官方[单条用户资料](https://developers.weixin.qq.com/doc/service/api/usermanage/userinfo/api_userinfo.html)、[批量用户资料](https://developers.weixin.qq.com/doc/service/api/usermanage/userinfo/api_batchuserinfo.html)与[网页授权资料](https://developers.weixin.qq.com/doc/service/api/webdev/access/api_snsuserinfo.html)文档。单条/批量均列出 unionid，条件是公众号绑定微信开放平台；网页授权接口另需 snsapi_userinfo 授权，不是可直接替换的后台查询接口。
- 应区分“服务号自身绑定某个开放平台，具备返回 UnionID 的条件”与“服务号和小程序绑定同一个开放平台，可以用 UnionID 匹配”。不同平台本身不能解释服务号完全不返回该字段。
- 2026-09-14T10:40:02Z，直接从 ECS 使用 AppID `wx6c2a6861fb6b945a` 获取当前关注者列表，并调用 `/cgi-bin/user/info/batchget`：列表总数 53、返回 53、已关注 53、返回身份集合与请求一致、API 无错误、存在 unionid 字段的记录为 0。仅输出汇总，无用户标识或凭据，无数据库写入、无发送消息。
- 单条抽查与批量全部查询均未返回字段；已排除这些请求中的应用解析/入库丢字段，以及仅单条接口异常的假设。尚不能确定微信侧的具体原因，不将“绑定未完成”作为已证实结论。
- 用户已确认服务号与小程序同属一个开放平台。尝试只读查看微信开发者后台时，被浏览器站点安全策略拒绝，未通过其他浏览器或后台请求绕过。需用户提供开放平台管理中心中该服务号 AppID 与绑定状态的截图（可遮盖身份信息），再判断是否需要向微信官方提交接口诊断。未更改绑定、未强制刷新 token。

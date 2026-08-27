# iad1 查询向量中转实施记录

## 结论

线上查询继续使用 `qwen3-vl-embedding` 和 1024 维向量，不迁移模型，也不重建现有语料向量或离线邻居表。

数据库与搜索聚合 Function 保持在数据库邻近区域；只有 DashScope 查询向量请求通过固定在 Vercel `iad1` 的受保护中转路由发送到阿里云中国区。

```text
搜索 Function（Production: sin1）
  -> /api/search/embedding-relay（iad1）
  -> DashScope 中国区 qwen3-vl-embedding
  -> 1024 维查询向量
  -> 原搜索 Function 执行 pgvector 与离线邻居查询
```

## 实施内容

- `main/vercel.json` 将以下 Function 固定到 `iad1`：
  - `/api/search/embedding-relay`
  - `/api/auth/sms-relay`（只调用阿里云短信，不访问数据库）
- 登录、绑定手机和问卷手机号验证等业务 API 不再固定到 `iad1`，继续运行在项目默认的数据库邻近区域；这些 API 完成频控、验证码记录等数据库逻辑后，仅把最终短信发送动作交给中转。
- `main/lib/search/query-embedding.ts`：
  - Vercel 环境通过当前部署的 `VERCEL_URL` 调用中转；
  - 本地开发未配置中转时保留直接调用 DashScope 的能力；
  - 中转和直接调用使用独立缓存键，缓存时间仍为 5 分钟；
  - 校验中转返回值必须是 1024 维；
  - 中转失败后由现有搜索路由执行降级，不从亚洲区域再次直连中国区。
- `/api/search/embedding-relay`：
  - 使用独立 Secret 鉴权，并采用定时安全比较；
  - 不访问数据库；
  - 不记录或返回 DashScope API Key；
  - 返回向量的响应设置 `Cache-Control: no-store`。

## 环境变量

| 名称 | 用途 | 默认行为 |
| --- | --- | --- |
| `SEARCH_EMBEDDING_RELAY_SECRET` | 搜索 Function 与中转 Function 的共享密钥 | Vercel 必填 |
| `SEARCH_EMBEDDING_RELAY_URL` | 显式中转 URL | Vercel 默认使用当前 `VERCEL_URL`，通常不填 |
| `SEARCH_EMBEDDING_RELAY_TIMEOUT_MS` | 搜索 Function 等待中转的超时 | 6000ms |
| `DASHSCOPE_API_KEY` | iad1 中转访问 DashScope 中国区 | 沿用现有配置 |
| `ALIYUN_SMS_RELAY_SECRET` | 短信业务 API 与短信中转的共享密钥 | Vercel 必填，与搜索中转密钥分离 |
| `ALIYUN_SMS_RELAY_URL` | 显式短信中转 URL | Vercel 默认使用当前 `VERCEL_URL`，通常不填 |
| `ALIYUN_SMS_RELAY_TIMEOUT_MS` | 业务 API 等待短信中转的超时 | 12000ms |

`SEARCH_EMBEDDING_RELAY_SECRET` 与 `ALIYUN_SMS_RELAY_SECRET` 均已作为相互独立的 Vercel Secret 配置到 Production、Preview 和 Development，不写入 Git。

短信中转不会自动重试。连接已建立但响应超时时，无法判断供应商是否已发送短信；自动重试可能导致用户收到两个相同验证码。失败由调用端提示用户稍后手动重试。

## 验证结果（2026-08-27）

### iad1 直接模型稳定性

使用唯一查询绕过缓存，连续调用 20 次：

- 成功率：20/20，100%；
- 超时：0；
- 返回维度：全部 1024；
- 模型内部耗时：min 347ms、P50 372ms、P95 797ms、max 1215ms。

### 完整搜索 Preview

对 `饮茶、早晨、粤语、食饭、凉茶、醒狮、点心、街市、龙舟、功夫` 执行完整语义搜索：

- 10/10 返回 `sectionStatus.semantic = success`；
- 每次返回 3 条 similar 和 4 条 recommended；
- 首次冷请求 8279ms；
- 其余请求 1757–3680ms；
- 全部请求 P50 2382ms。

Preview 主搜索 Function 当次运行在 `hnd1`；中转路由响应头为 `hnd1::iad1::*`，证明中转 Function 实际运行在 `iad1`。Production 主搜索仍由项目级配置运行在 `sin1`。

### 短信中转 Preview

- Preview 构建成功；
- 无鉴权调用 `/api/auth/sms-relay` 返回 401，`x-vercel-id` 为 `hnd1::iad1::*`；
- 空载荷调用 `/api/miniprogram/auth/send-sms` 返回 400，`x-vercel-id` 为 `hnd1::hnd1::*`；
- 由此确认 Preview 中只有短信网络调用进入 `iad1`，完整业务接口没有被带离默认区域；Production 对应业务接口将跟随项目默认的 `sin1`；
- 单元测试覆盖中转 URL、鉴权头、请求体、缺少密钥时的安全失败，以及无效手机号不触发中转。

## 部署与回滚

部署后检查：

1. Vercel 构建详情中 `/api/search/embedding-relay` 的区域为 `iad1`；
2. 无鉴权调用中转应返回 401，响应头第二段区域应为 `iad1`；
3. 使用多个未缓存关键词验证语义状态为 `success`；
4. 观察日志中不再出现来自 `sin1` 的 DashScope `TimeoutError`。

短信链路同时检查：

1. `/api/auth/sms-relay` 的区域为 `iad1`，无鉴权调用返回 401；
2. `/api/miniprogram/auth/send-sms`、`/api/auth/send-sms-verification`、`/api/user/phone/send-bind-code` 和问卷手机号接口没有单独区域覆盖，跟随项目默认区域；
3. 业务 API 日志负责数据库阶段，中转日志只包含阿里云调用耗时和脱敏后的执行结果；
4. 缺少 `ALIYUN_SMS_RELAY_SECRET` 时 Vercel 环境安全失败，不从亚洲区域回退为阿里云直连；本地开发完全未配置中转变量时仍可直连。

回滚时移除搜索客户端的中转逻辑和 `vercel.json` 中的中转区域配置。不要只删除 `SEARCH_EMBEDDING_RELAY_SECRET`：Vercel 环境缺少该变量时，当前实现会主动进入搜索降级，避免重新产生跨境直连超时。

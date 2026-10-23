# Search 小程序接口与埋点对接（AW）

基线：2026-10-23。适用独立微信小程序「粤语随手查」，应用标识固定 `search-app`。本文件随接口部署，是这批接口的唯一对接契约（线上路径 `/docs/search-app-integration.md`）；发布状态和联调地址见文末，不把 PR 创建或 Preview 成功等同于正式上线。

## 先做什么，后做什么

| 顺序 | 负责人 | 工作 | 进入下一步的条件 |
| --- | --- | --- | --- |
| 0 | 后端 / Fynn | 配置 Search 小程序、建反馈表、部署本批 dev/main PR；提供联调地址与可搜索词 | 搜索、详情和匿名反馈接口可访问 |
| 1 | AW | 设置 request 合法域名，封装请求/错误处理、匿名 ID 和 requestId | 能在微信开发者工具拿到搜索 JSON，不能只用浏览器判断 |
| 2 | AW | 先做游客搜索 → 结果分区 → 详情 → 音频 → 分享 | 不登录也能完成核心查询；空结果、下架、失败、音频缺失状态闭环 |
| 3 | AW + Fynn | 接 `wx.login`，传 `miniprogramApp: search-app`，验证真实登录及刷新 | 新 AppID 已绑定相应微信开放平台，返回 unionid；真实 code 登录成功 |
| 4 | AW | 登录后本地最近查询、匿名/登录反馈；Fynn 验证后台收到并处理 | 反馈请求失败可重试，重试不新增重复记录；本地历史不串账号 |
| 5 | AW + Fynn | 接页面、搜索、音频、分享、反馈埋点，核对后台 Search 小程序统计 | 不是只看 204：后端确认 app 归属、参数和实际入库；清理 QA 数据 |
| 6 | 产品 / AW / Fynn | 真机、弱网、账号切换、下架及生产域名复验 | 达到文末验收清单；再讨论二期功能 |

后端会分别向 dev、main 提 PR。AW 需要正式域名联调时，应等 main PR 合并、生产部署成功；dev PR 用于开发预览，两份 Search 业务实现保持一致。不得为小程序联调直接把 dev 的其他待发布功能整体带入 main。

已确认首期：只搜**公开口语语料，且有表达及释义**；搜索/阅读/播放无需登录；反馈可匿名，登录后由服务端关联账号。最近查询由小程序保存，收藏二期。场景、今日一句等产品确认；AI 不在本批范围。前端不展示尚无接口的入口。

## 环境、身份与通用约定

- 生产 API 根地址：`https://search.aidimsum.com`。本批新接口上线前，该地址可能仍返回 404，见发布状态。
- Preview 地址见 PR；微信真机若要请求预览域名，仍须满足微信合法域名配置，不把开发者工具跳过域名校验当作真机通过。
- Search AppID：`wx957c05dc9851fc9f`。AppSecret 仅由后端环境变量持有，不放入小程序、文档或仓库。
- 服务端环境变量：`WECHAT_MINIPROGRAM_SEARCH_APPID`、`WECHAT_MINIPROGRAM_SEARCH_SECRET`。Vercel Preview / Production 已配置，新部署后生效。
- 本批新接口均返回 JSON，禁止缓存敏感/动态状态；读接口成功 200，反馈首次创建 201，幂等重放 200。
- 新接口错误：`{"error":{"code":"ENTRY_UNAVAILABLE","message":"该内容暂不可用"}}`。网络失败不具有该 JSON，由 AW 单独处理。
- 登录、刷新仍沿用旧通用接口及原有错误格式，错误解析须同时兼容字符串 `error` 与对象 `error.message`。
- 可选登录头：`Authorization: Bearer <accessToken>`。搜索/详情不因缺少令牌被拦；反馈带无效/过期令牌返回 401，不能误当成已关联用户。
- ID 全部作为字符串处理，尤其不要把内容 ID 转数字。内容 ID 是已有语料 `unique_id`（UUID），不是数据库自增 ID。
- 首次启动生成 UUID v4 `anonymousId` 并持久化；本批反馈和埋点使用同一匿名 ID。不要使用 openId、手机号或设备标识替代。

## 登录（复用通用能力）

`POST /api/miniprogram/auth/login`

```json
{"code":"wx.login 返回的临时 code","miniprogramApp":"search-app"}
```

返回 `accessToken`、`refreshToken`、`user`，沿用通用接口。`POST /api/miniprogram/auth/refresh` 刷新；刷新请求体为 `{"refreshToken":"登录或上次刷新得到的 refreshToken"}`，返回新的 accessToken 和 refreshToken；成功后同时替换本地两个令牌。短信登录仍使用同一登录接口的 `phoneNumber`、`verificationCode`，并传 `miniprogramApp: search-app`，发码路径 `/api/miniprogram/auth/send-sms`。

微信 code 只能及时使用一次，不把固定 code 写入代码。后端沿用现有 unionid 账号关联规则；微信未返回 unionid 时会明确失败，需先检查新小程序的开放平台绑定。不能为了“能登录”擅自改为按 openId 创建另一套账号。

搜索和听音不要求手机号授权；登录失败不阻塞游客查询。

## 搜索

`GET /api/miniprogram/search/entries?q=唔该&limit=20&requestId=<UUID>`

| 参数 | 规则 |
| --- | --- |
| q | 必填，去首尾空格后 1–100 字符；URL 编码 |
| limit | 1–20，默认 20，作用于 direct + related 的合计条数 |
| cursor | 下一页原样传 nextCursor；不要解码、拼接或跨关键词复用 |
| requestId | 可选 UUID，建议 AW 在每次有效搜索提交时生成；翻页、网络重试沿用本次查询 ID，供埋点关联；未传时服务端生成并回传 |

服务端固定公开 + oral 范围，不开放客户端自选语料集或内容大类。展示资格在数据库分页前过滤，不采用“取 20 条再在前端删掉无释义内容”的方式。

```json
{
  "query": "唔该",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "direct": [
    {
      "id": "从接口取得的内容 UUID",
      "expression": "唔该",
      "senses": [{"meaning":"打扰下；谢谢","jyutping":"m4 goi1","audio":"https://有效粤语资源地址","usageNotes":null,"examples":[]}],
      "source": {"datasetSlug":"数据集标识","datasetName":"数据集展示名称","licenses":[]},
      "available": true
    }
  ],
  "related": [],
  "nextCursor": null
}
```

直接匹配按去导入后缀、简繁变体和不区分英文大小写后的**表达一致**判断；同一表达来自不同语料条目时保留各自内容 ID。相关表达按表达中的字词包含匹配，不把它包装成 AI 语义回答，也不承诺普通话释义反查。此轻量契约不等同于网页版 primary/similar/recommended 的全部检索策略。

- 首次结果 direct 非空：显示直接匹配区；related 非空则显示相关表达区。
- direct 为空、related 非空：先提示“未找到直接匹配”，再显示相关表达。
- 两者为空且 nextCursor 为 null：显示完全无结果；HTTP 503 或网络失败不可显示成“无结果”。
- direct 和 related 各自追加分页数据，按内容 ID 去重，不在翻页后清空前页分区；nextCursor 为空停止加载。
- 切换关键词后取消或忽略旧请求，只有最新查询可更新页面。返回结果页保留原关键词和合理滚动位置。
- 无 total：避免为轻量查询增加全量计数。新数据或下架可能改变后续页面，前端仍须按 ID 去重。

## 详情与内容字段

`GET /api/miniprogram/search/entries/{entryId}` → `{"entry":<与搜索完全相同的内容结构>}`。

不公开、非口语、缺表达/释义或不存在的内容统一 404 `ENTRY_UNAVAILABLE`，显示“该内容暂不可用”，提供返回搜索。不要用网页详情接口绕过小程序资格规则。

每个 `senses[]` 自带 meaning、jyutping、audio、usageNotes、examples；例句包含 text、translation、jyutping、audio。各读音/释义按原始条目的对应项保留，例句最多 3 条；原数据没有可靠例句或用法说明时为空，AW 不自行补编。不要拿一个义项的音频配到另一个义项/例句上。

- `audio` 为 HTTPS URL 或 null。只输出明确粤语标记、或同项有效粤拼等可确认的粤语音频；不使用普通话兜底。是否最终可下载/播放由真机结果决定，不能把 URL 存在视为资源必可用。
- `jyutping` 为经过基础格式校验的粤拼或 null；缺失时隐藏。
- `source` 使用真实数据集名称，licenses 仅返回该数据集实际登记的许可名称；为空时不宣称已核实额外授权，不展示虚构许可。
- 不返回 raw note、内部编辑权限或用户贡献者身份。原始数据错误通过反馈关联 ID 交后台处理。
- 音频无需单独业务接口。AW 需对接口实际返回的 OSS 域名配置 download 合法域名；客户端播放失败时给重试，不用普通话 TTS 顶替。
- 同时只播放一条；离开页面停止。词条音频与例句音频分别绑定，暂停后继续不要重复计首次播放。

## 反馈：匿名可提交，后台可处理

`POST /api/miniprogram/search/feedback`

```json
{
  "requestId":"550e8400-e29b-41d4-a716-446655440000",
  "anonymousId":"6f1c3d9a-1b2c-4d5e-8f90-123456789abc",
  "type":"audio_issue",
  "description":"这条音频无法播放",
  "entryId":"从搜索或详情取得的内容 UUID"
}
```

| 字段 | 规则 |
| --- | --- |
| requestId | 必填 UUID；一次反馈草稿的提交与重试保持相同 ID；修改正文、类型或关联内容后用新 ID |
| anonymousId | 必填 UUID，本机持久保存，与埋点一致 |
| type | content_error 内容有误 / audio_issue 音频问题 / suggestion 功能建议 / other 其他 |
| description | 去首尾空格后 1–300 字符；提交中禁用重复按钮，失败保留输入 |
| entryId | 可选，从详情进入自动携带。必须是当前可展示内容；失效时 404，可引导用户回通用反馈入口重新提交 |

请求体严格校验，不接收客户端自报 userId、状态、处理备注或提交时间。登录时带 Bearer，服务端验证账号 ACTIVE 后关联 user_id；匿名时不带头。匿名反馈不强迫授权手机号。

```json
{"id":"反馈 UUID","requestId":"原请求 UUID","status":"OPEN","createdAt":"2026-10-23T04:00:00.000Z","replayed":false}
```

同一身份、requestId、内容重试返回同一反馈 ID，`replayed:true`、HTTP 200；不会新增记录。重试时保留原来的登录身份；令牌失效先刷新，不要在已登录反馈超时后直接改为匿名重放。复用 ID 却修改内容/身份返回 409 `REQUEST_CONFLICT`。

同匿名 ID 或已登录用户每 10 分钟最多 5 次新反馈，超出返回 429 `RATE_LIMITED` 和 Retry-After: 600；幂等重试不消耗新次数。这是基础防重复/限流，不是跨设备的强身份校验。

后台入口：`/admin/search-miniprogram`。平台管理员/超管可按类型、状态筛选，查看正文与关联内容 ID，并保存 OPEN / IN_PROGRESS / RESOLVED / DISMISSED 状态、内部备注和处理人。非平台角色不能读取或处理。内部处理不等同于给用户发回复，首期无反馈进度查询或通知接口。

管理员 API：`GET /api/admin/search/feedback?page=1&status=OPEN&type=audio_issue`，固定每页 20 条；`PATCH /api/admin/search/feedback` 传 id、status、note、updatedAt。updatedAt 从列表原样带回；记录被别人更新则返回 409 `FEEDBACK_CHANGED`，刷新后重新处理，避免覆盖。

## 最近查询：AW 本地实现，无新增后端接口

按已登录 user.id 分开存 `search-history:<user.id>`；未登录不展示账号历史。只记录有效查询提交，不记录输入过程。trim、去重、重复移动到最前，首页 5 条、完整 20 条；清空先确认。退出/切换账号不能展示另一个人的历史。存储失败不阻断查询，不承诺跨设备同步。不调用反馈或埋点表作为用户可读历史数据库。

## 埋点契约

共用 `POST /api/public/analytics/events`；成功 204 无响应体，失败静默，不阻塞功能、不向用户 toast。204 包含过滤情况，联调由后端查库确认。

```json
{
  "anonymousId":"6f1c3d9a-1b2c-4d5e-8f90-123456789abc",
  "sessionId":"7f1c3d9a-1b2c-4d5e-8f90-123456789abc",
  "source":"miniprogram",
  "app":"search-app",
  "events":[{"name":"page_view","props":{"landing":true,"scene":1007},"path":"pages/search/index","locale":"zh-CN","time":"2026-10-23T04:00:00.000Z"}]
}
```

每批 1–20 条、≤32KB。`app` 必须放批次顶层，不放 props；旧客户端不带 app 仍可接收，但不会计入 Search 专属统计。匿名 ID 长期保存；sessionId 每次冷启动或后台闲置超过 30 分钟换新。已登录带 Bearer，用于服务端关联用户；路径不带查询参数，时间为带时区 ISO 8601。

| 事件 | 触发时机 | props |
| --- | --- | --- |
| page_view | 页面展示；每次实际进入一次，处理重复 onShow，不因播放弹层重复报 | landing（启动首屏 true）、scene（首屏取微信进入场景整数） |
| search_submit | 一次有效查询提交，不含输入变化和翻页 | query、requestId、origin（search_box / history） |
| search_section_impression | 当前页某分区实际展示一次；非空/空分区按实际数据记录 | query、section（direct→primary，related→similar）、resultCount、page（从 0）、status:success |
| search_result_click | 点击查询结果进入详情 | query、requestId、entryId、section（同上）、position（本分区从 0） |
| audio_play | 音频实际开始播放后，一次播放会话一次；不是点击按钮时 | entryId、audioId、playSessionId、surface、target、senseIndex、exampleIndex（例句必带） |
| audio_error | 播放前失败/超时，同一次加载尝试只报一次；离开或主动停止不报 | 上述音频字段，加 loadAttemptId、errorType |
| mp_share | 触发 onShareAppMessage/onShareTimeline | entryId、shareId（本次分享生成 UUID）、channel:chat/timeline |
| share_link_open | 读到分享参数并且目标详情加载成功后 | entryId、shareId、landingVisitId、sourceChannel:shared_link |
| feedback_submit | 一次提交尝试返回成功或失败，网络失败也要区分 | requestId、type、status:success/error、feedbackId（成功返回的 ID）、errorCode（失败时） |

音频字段：audioId 仅 URL pathname，不带域名、签名或 ?/# 参数；playSessionId/loadAttemptId 均 UUID；surface 为 search_result / entry_detail；target 为 expression / example；senseIndex 为 senses 数组下标；exampleIndex 为 examples 数组下标。errorType 为 timeout / network / resource_unavailable / unsupported / unknown，客户端可采用 15 秒播放前等待超时，报错与超时去重。暂停继续沿用 playSessionId，用户主动重新开始新的播放可生成新 ID；重试加载用新的 loadAttemptId。

反馈错误码仅允许：INVALID_FEEDBACK、INVALID_JSON、BODY_TOO_LARGE、INVALID_TOKEN、ENTRY_UNAVAILABLE、REQUEST_CONFLICT、RATE_LIMITED、SERVICE_UNAVAILABLE、NETWORK_ERROR。不要把反馈正文、手机号、openId、accessToken、音频签名链接或错误堆栈放入 props，未知字段会被剥离。

分享路径建议：`pages/entry/detail?id=<entryId>&from=share&sid=<shareId>`。接收方加载详情成功后再报 share_link_open；无内容/加载失败不报成功落地。mp_share 只代表触发分享，不能称“分享成功”。首期不做海报预览时，不上报 share_card_open；也不为了凑漏斗假报 copy/card 事件。

不要使用 PRD 草案中的别名 result_click / share_trigger / search_result，它们不是本批客户端事件名。查询结果和接口失败由后端 search_request 记录，AW 只报提交、展示和点击，避免重复统计。服务端分页请求标记 paged=true，不重复计查询次数。

后台 `/admin/search-miniprogram` 仅统计 app=search-app 的事件：查询数、直接匹配率、无结果率、失败数、访问人数、结果点击、音频播放/失败、分享触发，以及收到反馈/提交失败。日期按北京时间、最多 31 天。无结果率分母仅成功的首次查询，失败和翻页排除；反馈收到数来自业务表，客户端重复上报成功不增加业务反馈条数。

AW 可复用既有通用埋点对接代码，但发送批次时务必增加 app；原参考代码的历史 app.js/session 行为需按上述“冷启动/后台 30 分钟”处理，不把整个设备永远视为一个 session。

## 联调与验收顺序

1. 搜索一个已提供的公开词，取返回 id 查详情；匿名可用。
2. 验证空输入/超长输入 400、完全无结果 200、服务失败 503、无效 cursor 400；快速切词不被旧响应覆盖。
3. 检查直接/相关分区、连续分页无重复、无释义条目不出现；私有/文化类/下架内容不能通过改 ID 取详情。
4. 用有音频/无音频词条真机测试，检查粤语、义项对应、一次只播一条、暂停/重试/离开行为；例句无音频不借用词条音频。
5. 用本 AppID 的真实 wx.login code 联调。未完成这步前只能标“登录配置已就绪”，不能标“真实微信登录已验收”。
6. 匿名反馈、登录反馈各一条；重复提交保持同 ID、改内容换 ID；验证后台收到、用户关联、状态更新和无权限拒绝。联调反馈注明 QA，由后端清理。
7. 确认埋点顶层 app、搜索 requestId、音频/分享 ID 实际入库；只看 204 不算通过。正式匿名 ID 不用于测试删除。
8. 正式域名与真实设备再跑一遍，检查微信 request/download 合法域名、弱网、令牌刷新、存储失败和账号切换。

## 发布状态与接续

- dev：[PR #519](https://github.com/NonceGeek/dim-sum-app/pull/519)。
- main：[PR #520](https://github.com/NonceGeek/dim-sum-app/pull/520)。
- 两份 PR 已创建，当前未合并，正式接口尚未随本批发布。最新构建和 Preview 地址以各 PR 的 Vercel 检查为准。
- 后端已通过 7 项 Search 测试、dev 既有埋点 18 项 / main 既有埋点 7 项测试，以及两基线类型检查；dev 生产构建通过。实际数据库回滚验证及最终构建 HTTP 联调通过，QA 反馈、用户和埋点已精确清理。
- 可先用公开词 `唔该` 联调并从响应中取详情 ID，不要写死数据 ID。真实微信 code 登录和真机音频/域名验收尚未完成。复测命令（代码库 `main/`）：`npm run test:search-miniprogram`、`npm run test:analytics`、`node --import tsx scripts/search-miniprogram/verify-live.ts`。最后一项使用配置的数据库，在单个回滚事务中验证过滤、游标、反馈幂等、限流和权限，不保留 QA 行。

数据库为增量新表 search_feedback，已按 db pull → 差异审阅 → db push 应用并启用 RLS；应用行为以实际部署版本为准，不需要 AW 操作数据库。

产品待定项（场景/今日一句/AI）和二期收藏不作为本批联调阻塞条件。Fynn 负责本轮接口验收与发布配合；平台管理员具备反馈处理能力，正式运营反馈负责人待产品确认。AW 负责小程序页面、播放器、历史存储和客户端埋点。

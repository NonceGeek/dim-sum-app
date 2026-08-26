# 参赛前问卷小程序接口

> 状态：单租户 V1 接口契约
> 接口与业务负责人：Fynn
> 更新时间：2026-08-25

## 1. 概述

本文供小程序团队联调参赛前问卷。业务规则见 [questionnaire-business-rules.md](./questionnaire-business-rules.md)。

- 服务地址：`https://search.aidimsum.com`
- 问卷前缀：`/api/miniprogram/corpus_collection/questionnaire`
- 数据格式：JSON / UTF-8
- 认证：所有接口必须携带小程序 JWT。
- Header：`Authorization: Bearer <accessToken>`
- 时间：ISO 8601 UTC 字符串。
- ID：均按字符串传输。
- V1 为单租户，客户端不得传 `tenantId`。

活动详情仍可匿名读取，但点击“我要投稿”后的问卷与投稿流程必须登录。

登录接口和用户资料接口都会返回 `user.questionnaireStatus`，供小程序提前决定展示完整问卷、手机号补充或直达投稿。该状态只用于客户端 UI 分流；服务端仍以问卷档案和当前投稿范围（指定活动或自由投稿）的 journey 为最终真源。

```json
{
  "completed": true,
  "phoneVerified": true,
  "completedAt": "2026-08-20T08:00:00.000Z"
}
```

## 2. 通用错误结构

```json
{
  "error": "QUESTIONNAIRE_VALIDATION_FAILED",
  "message": "请完成必填题目",
  "details": {
    "fields": ["ageRange"]
  }
}
```

| HTTP | `error` | 场景 |
|---|---|---|
| 400 | `INVALID_REQUEST` | JSON、参数或枚举无效 |
| 400 | `QUESTIONNAIRE_VALIDATION_FAILED` | 问卷必填或选项校验失败 |
| 400 | `PHONE_INVALID` | 手机号格式错误 |
| 400 | `PHONE_CODE_INVALID` | 验证码错误或已过期 |
| 401 | `AUTH_REQUIRED` | Token 缺失或失效 |
| 403 | `QUESTIONNAIRE_REQUIRED` | 未完成登记，禁止进入或提交活动投稿/自由投稿 |
| 404 | `ACTIVITY_NOT_FOUND` | 活动不存在 |
| 409 | `MERGE_REQUIRED` | 手机号属于另一个账号，需要用户确认合并 |
| 409 | `PROFILE_ALREADY_EXISTS` | 重复创建不可变问卷档案 |
| 409 | `JOURNEY_STATE_CONFLICT` | 旅程状态与当前操作不匹配 |
| 410 | `JOURNEY_EXPIRED` | 旅程超过 24 小时 |
| 422 | `ACTIVITY_NOT_SUBMITTABLE` | 活动当前不可投稿 |
| 429 | `SMS_RATE_LIMITED` | 验证码发送过于频繁 |
| 500 | `INTERNAL_ERROR` | 未预期服务端错误 |

客户端只用稳定的 `error` 做分支，不解析 `message`。

## 3. 问卷 Schema

进入接口在 `flowType = full_questionnaire` 时返回服务端问卷 Schema。客户端应按 `code` 提交，展示文案只用于 UI。

Schema 来自数据库当前已发布版本。客户端必须保存进入接口返回的 `schemaVersion`，提交时原样传回；即使后台随后发布新版本，该旅程仍按原版本校验。下面的版本 1 仅为初始示例，客户端不得写死题目或选项。

```json
{
  "schemaVersion": 1,
  "questions": [
    {
      "key": "ageRange",
      "type": "single_choice",
      "required": true,
      "title": "你的年龄区间是？",
      "options": [
        { "code": "under_18", "label": "18岁以下" },
        { "code": "age_18_24", "label": "18-24" },
        { "code": "age_25_34", "label": "25-34" },
        { "code": "age_35_44", "label": "35-44" },
        { "code": "age_45_plus", "label": "45岁及以上" }
      ]
    },
    {
      "key": "cultureRegion",
      "type": "single_choice",
      "required": true,
      "title": "你更熟悉哪个地区的语言文化？",
      "description": "用于推荐更贴近你背景的活动内容，不涉及身份认证。",
      "options": [
        { "code": "guangzhou", "label": "广州" },
        { "code": "foshan", "label": "佛山" },
        { "code": "jiangmen", "label": "江门" },
        { "code": "hong_kong", "label": "香港" },
        { "code": "macao", "label": "澳门" },
        { "code": "zhuhai", "label": "珠海" },
        { "code": "shunde", "label": "顺德" },
        { "code": "overseas_cantonese", "label": "海外粤语文化圈" }
      ]
    },
    {
      "key": "interestTypes",
      "type": "multiple_choice",
      "required": false,
      "title": "你更感兴趣的活动类型是？",
      "options": [
        { "code": "language_usage", "label": "用语" },
        { "code": "story", "label": "故事" },
        { "code": "poetry", "label": "诗歌" },
        { "code": "place_name_explanation", "label": "地名解说" },
        { "code": "proverb", "label": "俗语" },
        { "code": "natural_conversation", "label": "自然对话" },
        { "code": "cantonese_film_tv", "label": "粤语影视剧" },
        { "code": "cantonese_dubbed_animation", "label": "粤语配音动画片" },
        { "code": "other", "label": "其他" }
      ]
    }
  ]
}
```

## 4. 创建投稿旅程

用户点击活动投稿或自由投稿的“我要投稿”后调用。该接口负责记录 `click_submit_cta` 并返回下一步。

- URL：`POST /api/miniprogram/corpus_collection/questionnaire/entry`
- 认证：必须

### 请求

```json
{
  "activityId": "123",
  "clientEventId": "b25da8a8-acde-4ee8-a2ec-d2d4eb07e0fe"
}
```

`activityId` 为可选字段：活动投稿传活动 ID，自由投稿省略。`clientEventId` 是客户端生成的 UUID。网络重试必须复用同一个值，服务端返回同一结果。

### 首次登记响应 `200`

```json
{
  "journeyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "flowType": "full_questionnaire",
  "registrationType": "first_time",
  "nextAction": "show_questionnaire_intro",
  "expiresAt": "2026-08-21T08:00:00.000Z",
  "contact": {
    "status": "missing",
    "maskedPhoneNumber": null
  },
  "questionnaire": {
    "schemaVersion": 1,
    "questions": []
  }
}
```

实际 `questions` 使用第 3 节完整结构。

### 只补手机号响应 `200`

```json
{
  "journeyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "flowType": "phone_only",
  "registrationType": "first_time",
  "nextAction": "show_phone_binding",
  "expiresAt": "2026-08-21T08:00:00.000Z",
  "contact": {
    "status": "missing",
    "maskedPhoneNumber": null
  },
  "questionnaire": null
}
```

### 资料复用响应 `200`

```json
{
  "journeyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "questionnaireJourneyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "activityId": "123",
  "allowed": true,
  "flowType": "reused",
  "registrationType": "reused",
  "nextAction": "open_submission_page",
  "expiresAt": "2026-08-21T08:00:00.000Z",
  "contact": {
    "status": "verified",
    "maskedPhoneNumber": "138****8000"
  },
  "questionnaire": null
}
```

资料完整用户应先直接打开投稿页，再在后台异步调用 `/entry` 准备埋点 journey。`/entry` 记录 `click_submit_cta`，但不代表投稿页已经真实打开；客户端拿到 `questionnaireJourneyId` 后异步上报 `enter_submission_page`。journey 请求失败不得关闭或阻塞投稿页。

自由投稿的返回结构相同，其中 `activityId` 为 `null`。小程序后续提交自由投稿时继续省略 `activityId`，不得把字符串 `"null"` 作为活动 ID 发送。

为兼容优化上线前使用相同 `clientEventId` 创建、且仍停留在 `completed` 状态的旧 journey，服务端可能返回 `nextAction = enter_submission`；客户端遇到该值时继续调用第 8 节接口即可。

接口不返回已保存的问卷答案。资料完整用户可以直接打开投稿页，但仍应尽力在后台异步调用 `/entry`，以保持 journey 埋点和后台资料复用统计完整。

## 5. 上报客户端交互事件

只用于服务端无法自行判断的 UI 行为。

- URL：`POST /api/miniprogram/corpus_collection/questionnaire/events`
- 认证：必须

### 请求

```json
{
  "journeyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "clientEventId": "09948a96-a829-4799-92da-6d047cf3219a",
  "eventName": "open_questionnaire"
}
```

允许的 `eventName`：

- `open_questionnaire`
- `continue_questionnaire`
- `cancel_questionnaire`
- `enter_submission_page`

`open_questionnaire` 在问卷或手机号弹窗首次完成渲染后上报一次。`enter_submission_page` 在投稿页真实完成打开后上报一次；资料完整用户应等异步 `/entry` 返回 journeyId 后在埋点任务内补报，不得等待埋点后才显示页面。完成问卷、手机号提交失败和成功投稿由服务端写事件，客户端不得伪造。问卷提交成功时服务端同时记录 `complete_questionnaire` 与兼容事件 `questionnaire_submit_success`；手机号提交失败时记录 `phone_submit_fail`，但需要用户确认账号合并的 `MERGE_REQUIRED` 不计为失败。

### 响应 `200`

```json
{
  "success": true,
  "eventId": "09948a96-a829-4799-92da-6d047cf3219a"
}
```

## 6. 发送绑定手机验证码

仅当进入接口返回 `contact.status = missing` 时调用。

- URL：`POST /api/miniprogram/corpus_collection/questionnaire/phone/send-code`
- 认证：必须

### 请求

```json
{
  "journeyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "phoneNumber": "13800138000"
}
```

### 响应 `200`

```json
{
  "success": true,
  "maskedPhoneNumber": "138****8000",
  "expiresInSeconds": 600,
  "retryAfterSeconds": 60
}
```

验证码用途必须使用独立命名空间，不能与手机号登录验证码混用。建议服务端 identifier：

```text
questionnaire-bind:<phoneNumber>:<userId>
```

## 7. 提交首次问卷或补充手机号

- URL：`POST /api/miniprogram/corpus_collection/questionnaire/submit`
- 认证：必须
- 幂等：同一旅程重复成功请求返回相同完成结果，不重复创建档案。

### 首次登记、已有手机号

```json
{
  "journeyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "schemaVersion": 1,
  "answers": {
    "ageRange": "age_25_34",
    "cultureRegion": "guangzhou",
    "interestTypes": ["story", "poetry"]
  }
}
```

### 首次登记、需要绑定手机号

```json
{
  "journeyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "schemaVersion": 1,
  "answers": {
    "ageRange": "age_25_34",
    "cultureRegion": "guangzhou",
    "interestTypes": []
  },
  "phoneBinding": {
    "phoneNumber": "13800138000",
    "verificationCode": "123456",
    "confirmMerge": false
  }
}
```

### `phone_only` 恢复

该流程不传 `answers`，避免覆盖已有档案。

```json
{
  "journeyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "phoneBinding": {
    "phoneNumber": "13800138000",
    "verificationCode": "123456",
    "confirmMerge": false
  }
}
```

### 成功响应 `200`

```json
{
  "completed": true,
  "registrationType": "first_time",
  "profileCompletedAt": "2026-08-20T08:10:00.000Z",
  "contact": {
    "status": "verified",
    "maskedPhoneNumber": "138****8000"
  },
  "nextAction": "show_success"
}
```

### 需要账号合并 `409`

```json
{
  "error": "MERGE_REQUIRED",
  "message": "该手机号已关联另一个账号，继续后将合并账号数据。",
  "details": {
    "canRetryWithSameCode": true
  }
}
```

小程序必须展示明确的合并确认。用户确认后使用相同验证码重试，将 `confirmMerge` 改为 `true`；用户取消则停留在当前活动页。

## 8. 确认进入投稿页

首次问卷或手机号补充流程的成功页点击“进入投稿页面”时调用。新创建的 `reused` 路径会由 `/entry` 直接返回 `nextAction = open_submission_page`，无需调用本接口；仅兼容旧 journey 返回 `nextAction = enter_submission` 时调用。

- URL：`POST /api/miniprogram/corpus_collection/questionnaire/enter-submission`
- 认证：必须

### 请求

```json
{
  "journeyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "clientEventId": "70817ee2-45f2-460f-ac60-e031479e94b5"
}
```

### 响应 `200`

```json
{
  "allowed": true,
  "activityId": "123",
  "questionnaireJourneyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "expiresAt": "2026-08-21T08:00:00.000Z",
  "nextAction": "open_submission_page"
}
```

服务端在返回前再次校验：

- 活动仍可投稿。
- 旅程属于当前用户和活动。
- 问卷档案存在。
- `User.phoneNumber` 非空。
- 旅程未过期。

## 9. 投稿创建接口变更

现有接口：

```text
POST /api/miniprogram/corpus_collection/submissions
```

活动投稿和自由投稿均支持问卷关联字段；自由投稿省略 `activityId`：

```json
{
  "activityId": "123",
  "questionnaireJourneyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "submissionType": "story",
  "title": "西关旧事",
  "intro": "投稿内容",
  "tags": ["城市记忆"],
  "media": []
}
```

规则：

- 首次问卷或手机号补充流程完成后，客户端仍应传 `questionnaireJourneyId`，以保持完整归因。
- 已完成问卷且已绑定手机号时，`questionnaireJourneyId` 可选；异步 journey 已返回就传，未返回或失败则省略。
- 自由投稿也受问卷门禁影响；首次问卷或手机号补充流程仍需传 `questionnaireJourneyId`。
- 旅程与投稿范围（指定活动或自由投稿）、用户不一致时返回 `403 QUESTIONNAIRE_REQUIRED`。
- 旅程过期返回 `410 JOURNEY_EXPIRED`，小程序重新调用进入接口。
- 资料完整用户省略 journey 时，服务端校验真实档案与手机号，查找最近有效 reused journey，必要时在投稿事务内补建。
- 投稿创建成功与 `submit_submission_success` 事件在同一事务内完成。

## 10. 小程序状态机

```text
IDLE
  -> 读取 user.questionnaireStatus
     -> AUTH_REQUIRED: 登录后重试
     -> full_questionnaire: POST /entry -> SHOW_INTRO -> SHOW_FORM -> SUBMITTING
     -> phone_only: POST /entry -> SHOW_PHONE -> SUBMITTING
     -> reused: OPEN_SUBMISSION_PAGE + ASYNC_PREPARE_JOURNEY

SUBMITTING
  -> MERGE_REQUIRED: SHOW_MERGE_CONFIRM
  -> success: SHOW_SUCCESS

SHOW_SUCCESS / reused 旧 journey
  -> POST /enter-submission
  -> OPEN_SUBMISSION_PAGE

OPEN_SUBMISSION_PAGE
  -> journey ready: POST /submissions with questionnaireJourneyId
  -> journey unavailable: POST /submissions without questionnaireJourneyId
```

资料完整用户不得等待 `/entry` 后才打开投稿页。`/entry` 与后续 `enter_submission_page` 上报属于非阻塞埋点流程；最终投稿不依赖它们成功。首次问卷和手机号补充流程仍以服务端 `nextAction` 为准。

## 11. 隐私与日志要求

- 前端日志、埋点和错误上报不得包含完整手机号或验证码。
- 接口响应不返回问卷历史答案。
- 验证码不得写入应用日志、事件 metadata 或审计日志。
- `clientEventId`、`journeyId` 可以用于问题排查。
- 网络重试应复用原 `clientEventId`，避免重复事件。

## 12. 联调验收用例

1. 未登录点击投稿，返回 `401 AUTH_REQUIRED`。
2. 首次用户、已有手机号，完成必填问卷后进入投稿页。
3. 首次用户、无手机号，验证码错误时不创建档案。
4. 兴趣类型传空数组时提交成功。
5. 未知枚举、重复兴趣值或缺少必填项时返回明确错误。
6. 手机号冲突先返回 `MERGE_REQUIRED`，确认后使用同一验证码成功。
7. 已完成且已绑定手机号的用户再次点击时立即打开投稿页，并异步调用 `/entry` 获取 reused journey；接口不返回答案。
8. `phone_only` 只接受手机号绑定，不接受答案覆盖。
9. 重复事件和重复提交保持幂等。
10. 伪造或过期 journey 时创建失败；资料完整用户省略 journey 时正常投稿并由服务端查找或补建。
11. 自由投稿与活动投稿受同一问卷门禁影响；自由投稿 journey 的 `activityId` 返回 `null`。
12. 客户端日志和接口响应中无完整手机号、验证码或已保存答案。
13. 登录和 profile 中的 `questionnaireStatus` 与问卷档案、手机号状态一致；客户端刷新后不会把本地状态作为投稿门禁真源。

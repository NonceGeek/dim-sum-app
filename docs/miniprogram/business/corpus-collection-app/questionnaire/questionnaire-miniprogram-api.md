# 参赛前问卷小程序接口

> 状态：单租户 V1 接口契约
> 接口与业务负责人：Fynn
> 更新时间：2026-08-20

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
| 403 | `QUESTIONNAIRE_REQUIRED` | 未完成登记，禁止进入或提交活动投稿 |
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

## 4. 创建参赛旅程

用户点击某个活动的“我要投稿”后调用。该接口负责记录 `click_submit_cta` 并返回下一步。

- URL：`POST /api/miniprogram/corpus_collection/questionnaire/entry`
- 认证：必须

### 请求

```json
{
  "activityId": "123",
  "clientEventId": "b25da8a8-acde-4ee8-a2ec-d2d4eb07e0fe"
}
```

`clientEventId` 是客户端生成的 UUID。网络重试必须复用同一个值，服务端返回同一结果。

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
  "flowType": "reused",
  "registrationType": "reused",
  "nextAction": "enter_submission",
  "expiresAt": "2026-08-21T08:00:00.000Z",
  "contact": {
    "status": "verified",
    "maskedPhoneNumber": "138****8000"
  },
  "questionnaire": null
}
```

接口不返回已保存的问卷答案。

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

`open_questionnaire` 在问卷或手机号弹窗首次完成渲染后上报一次。完成问卷、进入投稿页和成功投稿由服务端写事件，客户端不得伪造。

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

成功页点击“进入投稿页面”时调用。`reused` 路径收到 `nextAction = enter_submission` 后也必须调用。

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

活动投稿请求新增必填字段：

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

- 存在 `activityId` 时，`questionnaireJourneyId` 必填。
- 不带 `activityId` 的普通投稿不要求该字段。
- 旅程与活动、用户不一致时返回 `403 QUESTIONNAIRE_REQUIRED`。
- 旅程过期返回 `410 JOURNEY_EXPIRED`，小程序重新调用进入接口。
- 投稿创建成功与 `submit_submission_success` 事件在同一事务内完成。

## 10. 小程序状态机

```text
IDLE
  -> POST /entry
     -> AUTH_REQUIRED: 登录后重试
     -> full_questionnaire: SHOW_INTRO -> SHOW_FORM -> SUBMITTING
     -> phone_only: SHOW_PHONE -> SUBMITTING
     -> reused: ENTERING_SUBMISSION

SUBMITTING
  -> MERGE_REQUIRED: SHOW_MERGE_CONFIRM
  -> success: SHOW_SUCCESS

SHOW_SUCCESS / reused
  -> POST /enter-submission
  -> OPEN_SUBMISSION_PAGE

OPEN_SUBMISSION_PAGE
  -> POST /submissions with questionnaireJourneyId
```

前端不得根据本地缓存自行跳过 `/entry` 或 `/enter-submission`。

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
7. 已完成用户再次点击直接返回 `reused`，接口不返回答案。
8. `phone_only` 只接受手机号绑定，不接受答案覆盖。
9. 重复事件和重复提交保持幂等。
10. 活动投稿缺少、伪造或过期旅程时创建失败。
11. 普通非活动投稿不受问卷门禁影响。
12. 客户端日志和接口响应中无完整手机号、验证码或已保存答案。

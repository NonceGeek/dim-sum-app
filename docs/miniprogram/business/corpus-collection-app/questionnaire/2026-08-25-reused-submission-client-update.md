# 已完成问卷用户无阻塞投稿升级说明

> 适用客户端：语料采集小程序
> 更新时间：2026-08-25
> 兼容性：服务端兼容旧版小程序；新版小程序按本文接入

## 1. 更新目标

已经完成参赛前问卷并绑定手机号的用户，点击“我要投稿”后立即进入投稿页面，不等待数据库 journey 请求。

问卷 journey 继续用于埋点归因和后台统计，但不再作为资料完整用户进入投稿页或最终投稿的前置通行证。异步 journey 或埋点失败不得阻塞投稿业务。

活动投稿和自由投稿都受同一套问卷门禁影响。两者的唯一区别是：活动投稿传 `activityId`，自由投稿省略 `activityId`；自由投稿 journey 响应中的 `activityId` 为 `null`。

## 2. 登录与用户状态

以下两个接口都会返回 `user.questionnaireStatus`：

- `POST /api/miniprogram/auth/login`
- `GET /api/miniprogram/user/profile`

```json
{
  "completed": true,
  "phoneVerified": true,
  "completedAt": "2026-08-20T08:00:00.000Z"
}
```

客户端分支：

| 状态 | 行为 |
|---|---|
| `completed = false` | 调用 `/questionnaire/entry`，进入完整问卷流程 |
| `completed = true` 且 `phoneVerified = false` | 调用 `/questionnaire/entry`，进入手机号补充流程 |
| `completed = true` 且 `phoneVerified = true` | 立即打开投稿页，同时在后台异步准备 journey |

`questionnaireStatus` 只用于客户端 UI 分流。最终投稿时服务端仍查询数据库中的真实问卷档案和手机号。

## 3. 资料完整用户的新版流程

```text
点击“我要投稿”
  ├─ 立即打开投稿页
  └─ 后台异步 POST /questionnaire/entry
       ├─ 成功：保存 questionnaireJourneyId
       └─ 失败：记录日志或重试，但不提示用户退出投稿页

投稿页真实打开
  └─ journeyId 已取得后异步上报 enter_submission_page

用户最终提交
  ├─ journeyId 已取得：随投稿请求传入
  └─ journeyId 未取得：省略该字段，直接提交
```

不要等待 `/questionnaire/entry` 完成后再跳转页面。

## 4. 异步创建埋点 journey

请求：

```http
POST /api/miniprogram/corpus_collection/questionnaire/entry
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "activityId": "123",
  "clientEventId": "b25da8a8-acde-4ee8-a2ec-d2d4eb07e0fe"
}
```

自由投稿请求：

```json
{
  "clientEventId": "b25da8a8-acde-4ee8-a2ec-d2d4eb07e0fe"
}
```

资料完整用户响应：

```json
{
  "journeyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "questionnaireJourneyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "activityId": "123",
  "allowed": true,
  "flowType": "reused",
  "registrationType": "reused",
  "nextAction": "open_submission_page",
  "expiresAt": "2026-08-26T08:00:00.000Z"
}
```

该请求由点击动作异步触发，服务端会记录 `click_submit_cta`。网络重试必须复用相同的 `clientEventId`。

自由投稿响应结构相同，但 `activityId` 为 `null`。首次用户和仅缺手机号用户也必须先调用该接口，不能因为是自由投稿而跳过问卷流程。

## 5. 异步上报投稿页打开事件

投稿页 `onReady` 或首次有效 `onShow` 后上报一次。若此时 journey 尚未返回，可在内存中等待异步 journey；该等待只能发生在埋点任务内，不能阻塞页面。

```http
POST /api/miniprogram/corpus_collection/questionnaire/events
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "journeyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "clientEventId": "70817ee2-45f2-460f-ac60-e031479e94b5",
  "eventName": "enter_submission_page"
}
```

journey 创建失败时，本次 `enter_submission_page` 可以不报。这属于埋点缺失，不影响用户继续投稿。

## 6. 最终创建投稿

`questionnaireJourneyId` 对资料完整用户改为可选。

journey 已取得：

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

journey 未取得：

```json
{
  "activityId": "123",
  "submissionType": "story",
  "title": "西关旧事",
  "intro": "投稿内容",
  "tags": ["城市记忆"],
  "media": []
}
```

自由投稿同样传或省略 `questionnaireJourneyId`，但不传 `activityId`：

```json
{
  "questionnaireJourneyId": "9f2ca850-1b91-4c96-8124-bc7f4357e381",
  "submissionType": "story",
  "title": "西关旧事",
  "intro": "投稿内容",
  "tags": ["城市记忆"],
  "media": []
}
```

缺少 `questionnaireJourneyId` 时，服务端会在投稿事务内：

1. 活动投稿校验活动仍处于可投稿状态；自由投稿跳过活动状态校验。
2. 校验用户已有问卷档案。
3. 校验用户已绑定手机号。
4. 查找该用户在当前投稿范围（指定活动或自由投稿）最近一个有效的 reused journey。
5. 找不到时补建 reused journey。
6. 创建投稿、关联 journey 并记录投稿成功事件。

如果用户实际没有完成问卷或没有绑定手机号，仍返回 `403 QUESTIONNAIRE_REQUIRED`。

## 7. 推荐客户端伪代码

```ts
function handleSubmitEntry(activityId?: string) {
  const status = user.questionnaireStatus;

  if (!status.completed || !status.phoneVerified) {
    return startQuestionnaireFlow(activityId); // 自由投稿传 undefined
  }

  navigateToPostPage(activityId);

  const entryEventId = createUuid();
  const journeyPromise = prepareJourney(activityId, entryEventId);

  journeyPromise
    .then((result) => postPageStore.setJourneyId(result.questionnaireJourneyId))
    .catch((error) => reportNonBlockingAnalyticsError(error));

  Promise.all([journeyPromise, postPageReadyPromise])
    .then(([result]) => {
      return reportQuestionnaireEvent({
        journeyId: result.questionnaireJourneyId,
        clientEventId: createUuid(),
        eventName: "enter_submission_page",
      });
    })
    .catch((error) => {
      reportNonBlockingAnalyticsError(error);
    });
}

function submitPost(form: PostForm) {
  return createSubmission({
    ...form,
    ...(form.activityId ? { activityId: form.activityId } : {}),
    ...(postPageStore.journeyId
      ? { questionnaireJourneyId: postPageStore.journeyId }
      : {}),
  });
}
```

## 8. 验收清单

1. 资料完整用户在弱网下点击投稿，页面立即打开。
2. `/questionnaire/entry` 超时或失败不关闭投稿页、不阻止最终提交。
3. journey 成功时，投稿请求携带 `questionnaireJourneyId`。
4. journey 失败时，投稿请求省略该字段仍能成功。
5. 未完成问卷或未绑定手机号的用户省略 journey 时返回 `403 QUESTIONNAIRE_REQUIRED`。
6. 投稿页打开后只上报一次 `enter_submission_page`。
7. 所有埋点重试复用原 `clientEventId`，避免重复计数。
8. 自由投稿首次用户会进入完整问卷，缺手机号用户会进入手机号补充流程。
9. 自由投稿资料完整用户可直接打开投稿页，并异步创建 `activityId = null` 的 journey。

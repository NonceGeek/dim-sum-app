# 06 · S6 标注小程序最小改造契约

状态：参考版本；等待 Agent 方确认任务 payload 和完成接口幂等语义
原则：复用现有 Review App 和 `/api/miniprogram/task/*`，不创建第二套任务 API 或本地任务表。

## 一、现有接口直接复用

| 能力 | 当前接口 |
|---|---|
| 未完成任务 | `GET /api/miniprogram/task/uncompleted` |
| 已完成任务 | `GET /api/miniprogram/task/completed` |
| 通用筛选 | `GET /api/miniprogram/task/list` |
| 任务详情 | `GET /api/miniprogram/task/{id}` |
| 标记查看 | `POST /api/miniprogram/task/{id}/view` |
| 提交结果 | `POST /api/miniprogram/task/submit/{id}` |
| 跳过并重分配 | `POST /api/miniprogram/task/cancel/{id}` |
| 任务统计 | `GET /api/miniprogram/task/stats` |

这些接口已经完成小程序 JWT、标注员角色鉴权和 `actorRef` 注入，S6 不再新建 `/api/miniprogram/s6/review-tasks`。

## 二、S6 只增加任务类型与上下文

建议沿用 Agent task 对象，增加或确认：

```json
{
  "id": "agent-task-id",
  "status": "created",
  "violationType": "s6_secondary_category",
  "context": {
    "corpusName": "source-name",
    "corpusUniqueId": "entry-uuid",
    "sentenceText": "供判断的安全摘要",
    "contentAttribute": "oral",
    "primaryCategory": {
      "id": 1,
      "name": "..."
    },
    "currentSecondaryCategory": null,
    "candidateSecondaryCategory": {
      "id": 10,
      "name": "..."
    },
    "evidence": [
      { "field": "data", "quote": "..." }
    ],
    "rationale": "一句话说明",
    "taskPurpose": "classification_confirm"
  },
  "suggestions": []
}
```

`taskPurpose` 首期只需要：

```text
classification_confirm
classification_sample
```

内容校对、权利确认、派生内容审核不因原型页面存在而自动进入本期。

## 三、列表与详情

AW 使用现有列表参数：

```text
status
assigneeRef
corpusName
violationType=s6_secondary_category
q
page
pageSize
```

页面只展示完成判断所需的信息：

- 来源语料集；
- Entry 摘要和 Unique ID；
- 内容属性；
- 一级分类；
- Agent 候选二级分类；
- 依据和简短说明；
- 确认、修改、留空、跳过。

不展示：

- Agent 提示词；
- 模型内部推理；
- 完整未脱敏响应；
- 数据库结构和技术状态。

## 四、提交结果

继续使用：

```text
POST /api/miniprogram/task/submit/{taskId}
```

建议提交结构：

```json
{
  "selected": [
    {
      "action": "confirm",
      "entryId": "uuid",
      "categoryId": 10,
      "note": "可选"
    }
  ]
}
```

`action`：

```text
confirm   接受候选
modify    选择另一二级分类
empty     暂不分类/不适用
```

跳过任务继续调用现有 cancel/skip-and-reassign 接口，不把“跳过”伪装成分类留空。

## 五、Fynn 正式写回

当前完成接口只转发 Agent，尚未写 `corpus_category`。S6 需要在现有链路上补充一个明确的最终写回步骤，但不需要本地任务表。

推荐最小流程：

```text
AW 提交
  -> Fynn 校验登录用户、taskId、entryId、categoryId
  -> 调用 Agent complete（必须支持幂等）
  -> 读取 Agent 返回的已完成任务和最终选择
  -> Fynn 事务写入/更新 corpus_category
  -> 返回 writebackStatus=succeeded
```

正式写回规则：

- `confirm/modify`：写入 `corpus_category`，source 使用最终确认的约定值；
- `empty`：不制造虚假分类；
- categoryId 必须属于当前有效二级分类；
- Entry 必须存在且未在请求间发生不兼容变化；
- 同一 taskId 重试必须得到相同结果；
- Agent 完成成功但本地写回失败时，返回明确 `writeback_failed`，允许同一决定重试。

是否需要一张 `corpus_category_review_state` 保存候选和写回状态，等 Agent 是否能稳定提供任务历史与最终结果后决定。

## 六、状态来源

```text
任务状态        Agent 服务为准
正式分类        DimSum corpus_category 为准
候选分类        Agent task；必要时再增加轻量本地镜像
标注员身份      DimSum JWT/User 为准
公开 Search     Fynn Search 规则为准
```

AW 不直连数据库，Agent 不直接写正式 `corpus_category`。

## 七、通知

通知只传：

```text
taskId
taskPurpose
安全摘要
```

完整内容进入小程序后通过鉴权接口获取。通知渠道、模板和发送状态由 Agent/AW 现有能力决定，本期不为通知单独创建 outbox。

## 八、待 Agent 方确认

1. `violationType/taskPurpose` 的最终枚举。
2. context 是否能稳定返回 corpusUniqueId、候选 categoryId 和 evidence。
3. complete 重复调用是否幂等。
4. completed task 是否可长期查询。
5. Agent 完成结果是否返回最终规范化选择。
6. Agent 是否支持按任务类型和来源筛选。

这些问题确认前，只能开发 AW 页面适配和 Fynn 参数校验，不能冻结新的本地任务表。

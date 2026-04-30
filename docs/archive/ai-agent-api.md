# API 接口文档

## 鉴权方式：

- 通过 HTTP 请求头 `Authorization` 传递 token，格式为 `Bearer <token>`
- token 之后再给，现在没有也可以调用

## 调用流程：

1. 用户创建规则 rule，设置定时执行时间，并绑定语料库
2. rule 到达执行时机，调用 `/rules/run` 接口，创建一个 run
3. run 执行完成后，检测到的每条错误会创建一个 task；有错误的语料会通知一次标注员
4. 标注员查看通知，调用 `/tasks/:id/view` 接口，将 task 状态更新为已查看
5. 标注员选择备选项，调用 `/tasks/:id/complete` 接口，提交选项后，将 task 状态更新为已完成
6. 标注员选择跳过，调用 `/tasks/:id/skip-and-reassign` 接口，此时 Agent 服务选择下一个标注员，调用微信 API，通知标注员

---

## API 列表

### Agent 执行列表

规则每触发一次 `/rules/run` 就会创建一个 run

GET `/runs`

Query String 查询参数：

- `page`（默认 1），`pageSize`（默认 10）
- `status` 规则执行状态，多个状态用英文逗号分隔
  - `pending` 待执行
  - `running` 执行中
  - `cancelling` 取消中
  - `cancelled` 已取消
  - `completed` 已完成
  - `failed` 失败
- `ruleId` 规则ID，多个ID用英文逗号分隔
- `corpusName` 语料库名称，多个名称用英文逗号分隔

Response body:

```json5
{
  items: [
    {
      id: 'string',
      status: 'string',
      ruleId: 'string',
      corpusName: 'string',

      // 从用户自然语言描述的规则中提取的内部任务类型
      // - `grammar_check` 语法检查
      // - `phonetic_check` 注音检查
      // - `llm_generic` 通用 LLM 检查
      taskType: 'string',

      // 语料总数
      totalRecords: 0,
      // 已检查的语料数
      totalRecordsChecked: 0,
      // 检查不通过的语料数
      recordsWithViolations: 0,
      // 检查不通过的数量（一个语料可能有多个出错的地方，因此 totalViolations >= recordsWithViolations）
      totalViolations: 0,

      createdAt: '2021-09-22T09:55:00.000Z',
      updatedAt: '2021-09-22T09:55:00.000Z',
      endedAt: '2021-09-22T09:55:00.000Z',
    },
  ],
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
  },
}
```

### 调用 Agent 运行规则

POST /rules/run

Request body:

```json
{
  "ruleText": "<用户用自然语言描述的规则>",
  "ruleId": "<规则ID>",
  "ruleVersion": "<规则有版本概念，传入版本唯一标识符>",
  "corpusName": "<给规则绑定的语料库名称>",
  "agentId": "<给规则绑定的 agent id，目前只有一个 agent，可以先不传>"
}
```

### 规则编译检查

POST /rules/compile

检查自然语言规则是否可以被 Agent 理解。

Request body:

```json
{
  "ruleText": "<用户用自然语言描述的规则>"
}
```

Response body:

```json
{
  "pass": true,
  "failureReason": "<当 pass=false 时，编译不通过的原因>"
}
```

### 获取 Agent 列表

GET `/agents`

获取 Agent 列表，现在只有一个 Agent。

Response body:

```json
[
  {
    "id": "string",
    "name": "string"
  }
]
```

### 获取标注员任务列表

GET `/tasks`

Query String 查询参数：

- `actorRef`, 查看页面的标注员的 User ID，用来筛选这个人下面的任务，必填
- `corpusName`，多个名称用英文逗号分隔
- `status`，任务状态，多个状态用英文逗号分隔
  - `created` 已创建，尚未通知
  - `notified` 已通知（或已再次通知），尚未查看
  - `in_progress` 已查看，处理中
  - `reassigning` 转派中
  - `completed` 已完成
  - `cancelled` 已取消
- `violationType`，语料问题类型，多个类型用英文逗号分隔
  - `phonetic_mismatch` 注音不匹配
  - `grammar_violation` 语法问题
  - `llm_generic_violation` 通用 LLM 检测问题

Response body:

```json5
{
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
  },
  items: [
    {
      id: 'string',
      status: 'string',

      // 语料问题的类型
      violationType: 'string',

      context: {
        // 问题所在的语料库名称
        corpusName: 'string',

        // 问题所在的语料 unique_id
        corpusUniqueId: 'string',

        // 问题所在的句子原文
        sentenceText: 'string',

        // 问题所在的字，只有注音类的问题才有这个字段
        problemChar: 'string',
      },
      createdAt: '2021-09-22T09:55:00.000Z',
    },
  ],
}
```

### 获取任务详情

GET `/tasks/:id`

获取任务详情，以及供标注员选择的备选项

Response body:

```json5
{
  id: 'string',
  status: 'string',
  // 违规类型
  violationType: 'string',
  context: {
    // 问题所在的语料库名称
    corpusName: 'string',
    // 问题所在的语料 unique_id
    corpusUniqueId: 'string',
    // 问题所在的句子原文
    sentenceText: 'string',
    // 问题所在的字，只有注音类的问题才有这个字段
    problemChar: 'string',
  },
  // 标注员选择的备选项，根据不同的 violationType 有不同的结构
  suggestions: [],
  createdAt: '2021-09-22T09:55:00.000Z',
}
```

suggestions 的结构：

violationType=phonetic_mismatch 时：

```json5
{
  suggestions: [
    {
      // 建议来源：lexicon（字典）或 llm（大模型）
      source: 'lexicon | llm',
      // 作为基准字典用的语料库名称，当 source=lexicon 时存在
      lexiconBaseCorpusName: 'zyzdv2',
      // 建议值（如：推荐的注音）
      value: 'string',
      // 建议值对应的字符位置，index 从 0 开始，对应的是 context.sentenceText 的索引
      position: { index: 3 },

      // 对建议的解释说明，只在 source=llm 时存在
      explanation: 'string',
    },
  ],
}
```

同一 `position` 可能出现多条建议：

- 字典来源的至少一条，可能多条
- llm 最多一条，可能没有
- llm 的结果即使与字典相同，也不去重

violationType=grammar_violation 或者 llm_generic_violation 时：

```json5
{
  suggestions: [
    {
      source: 'llm',
      value: 'string',
      explanation: 'string',
    },
  ],
}
```

### 标记任务为已查看

POST `/tasks/:id/view`

```json5
{
  // 查看任务详情的标注员的标识
  actorRef: 'string',
}
```

### 完成任务

POST `/tasks/:id/complete`

```json5
{
  // 完成任务的标注员的标识
  actorRef: 'string',
  // 标注员选择的备选项，根据不同的 violationType 有不同的结构，直接将 suggestions 中选中选项的内容复制过来即可，单选，单元素数组
  selected: [],
}
```

### 跳过并重新分配任务

POST `/tasks/:id/skip-and-reassign`

```json5
{
  // 选择“跳过”的标注员的标识
  actorRef: 'string',
}
```

## 数据结构

```ts
type RunStatus =
  | 'pending'
  | 'running'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'failed'

type ViolationType =
  | 'phonetic_mismatch'
  | 'grammar_violation'
  | 'llm_generic_violation'

type TaskStatus =
  | 'created'
  | 'notified'
  | 'in_progress'
  | 'reassigning'
  | 'completed'
  | 'cancelled'

type TaskSuggestion = PhoneticSuggestion | GrammarOrGenericSuggestion

// 针对 phonetic_mismatch
type PhoneticSuggestion =
  | {
      source: 'lexicon'
      lexiconBaseCorpusName: string
      value: string
      position: { index: number }
    }
  | {
      source: 'llm'
      value: string
      position: { index: number }
      explanation: string
    }

// 针对 grammar_violation / llm_generic_violation
type GrammarOrGenericSuggestion = {
  source: 'llm'
  value: string
  explanation: string
}
```
1. 未处理页面
   1. get 接口，获取到多个数据来源的字，需要的内容：字，数据来源，粤音（n 个），词组，情感及情感对应的例句（n 个）
   2. post 接口，参数 taskId，点击取消，给系统重新推送
   3. post 接口，参数 taskI 的，点击提交，内容包括字，数据来源，粤音（n 个），词组，情感及情感对应的例句（n 个）—— 该内容涉及用户手动填写
2. 任务列表
   1. get 接口，获取已处理任务，需要返回字，数据来源，粤音（n 个），词组，情感及情感对应的例句（n 个） ，taskID，完成时间，目前状态，处理人
   2. get 请求，获取到未处理任务

## 一、未处理页面

### 1.1 获取单条任务信息

获取到多个数据来源的字，需要的内容：字，数据来源，粤音（n 个），词组，情感及情感对应的例句（n 个）

#### 接口信息

- **URL**: `/api/task/:id`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求头

```
  Authorization: Bearer <accessToken>
```

#### 返回结果

```json
[
  {
    "data": "爱",
    "source": "来源 A",
    "cantonesePronunciations": ["oi3", "ngoi3"],
    "phrases": ["爱心", "爱情"],
    "sentiments": [
      {
        "sentiment": "积极",
        "exampleSentences": ["我爱我的家人。", "她对生活充满爱。"]
      },
      {
        "sentiment": "消极",
        "exampleSentences": ["失去爱的人很痛苦。", "他感到孤独和无助。"]
      }
    ]
  },
  {
    "data": "爱",
    "source": "来源 B",
    "cantonesePronunciations": ["xx", "xx"],
    "phrases": ["xx", "xxx"],
    "sentiments": [
      {
        "sentiment": "xxx",
        "exampleSentences": ["xxxx", "xxxxx"]
      },
      {
        "sentiment": "xxx",
        "exampleSentences": ["xxx", "xxx"]
      }
    ]
  }
]
```

### 1.2 拒绝标注

点击取消，给系统重新推送

#### 接口信息

- **URL**: `/api/task/cancel/:id`
- **方法**: `POST`
- **认证**: 需要 Bearer Token

#### 请求头

```
  Authorization: Bearer <accessToken>
```

#### 返回结果

```json
{
  "status": "success",
  "message": "Task has been rejected and re-queued."
}
```

or

```json
{
  "error": "xxxx"
}
```

### 1.3 确认标注修改

确认修改

#### 接口信息

- **URL**: `/api/task/submit/:id`
- **方法**: `POST`
- **认证**: 需要 Bearer Token

#### 请求头

```
  Authorization: Bearer <accessToken>
```

#### 请求参数

```json
{
  "accessToken": "accessToken",
  "entries": [
    {
      "data": "爱",
      "source": "来源A",
      "cantonesePronunciations": ["oi3", "ngoi3"],
      "phrases": ["爱心", "爱情"],
      "sentiments": [
        {
          "sentiment": "积极",
          "exampleSentences": ["我爱我的家人。", "她对生活充满爱。"]
        },
        {
          "sentiment": "消极",
          "exampleSentences": ["失去爱的人很痛苦。", "他感到孤独和无助。"]
        }
      ]
    },
    {
      "data": "爱",
      "source": "来源B",
      "cantonesePronunciations": ["xx", "xx"],
      "phrases": ["xx", "xxx"],
      "sentiments": [
        {
          "sentiment": "xxx",
          "exampleSentences": ["xxxx", "xxxxx"]
        },
        {
          "sentiment": "xxx",
          "exampleSentences": ["xxx", "xxx"]
        }
      ]
    }
  ]
}
```

#### 返回结果

```json
{
  "status": "success",
  "message": "Task has been updated successfully."
}
```

or

```json
{
  "error": "xxxx"
}
```

## 二、任务列表

### 2.1 获取已处理任务列表

获取到多个已处理任务

#### 接口信息

- **URL**: `/api/task/completed`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求头

```
  Authorization: Bearer <accessToken>
```

#### 返回结果

```json
[
  {
    "taskName": "爱",
    "taskId": "12345",
    "completedAt": "2024-01-01T12:00:00Z",
    "status": "已完成",
    "processedBy": "用户 A",
    "entries": [
      {
        "data": "爱",
        "source": "来源 A",
        "cantonesePronunciations": ["oi3", "ngoi3"],
        "phrases": ["爱心", "爱情"],
        "sentiments": [
          {
            "sentiment": "积极",
            "exampleSentences": ["我爱我的家人。", "她对生活充满爱。"]
          },
          {
            "sentiment": "消极",
            "exampleSentences": ["失去爱的人很痛苦。", "他感到孤独和无助。"]
          }
        ]
      },
      {
        "data": "爱",
        "source": "来源 B",
        "cantonesePronunciations": ["xx", "xx"],
        "phrases": ["xx", "xxx"],
        "sentiments": [
          {
            "sentiment": "xxx",
            "exampleSentences": ["xxxx", "xxxxx"]
          },
          {
            "sentiment": "xxx",
            "exampleSentences": ["xxx", "xxx"]
          }
        ]
      }
    ]
  }
]
```

## 三、开发方案

### 3.1 小程序 API 中转层

1. **接口映射**：将本文件描述的 `/api/task/*` 请求映射到 Agent 服务的 `/tasks` 相关接口（详见 `docs/aiapi.md`），保持字段语义一致，必要时做结构转换（如 `entries` 数组）。
2. **认证**：沿用现有小程序 JWT（`requireMiniprogramAuth`），在 Next.js API Route 中校验后再向 Agent 发起请求。
3. **Agent 客户端**：新增 `lib/services/agent.ts` 封装基础 URL、鉴权头、错误处理，提供 `getTask`、`cancelTask`、`submitTask`、`listTasks` 等方法，供 API Route 调用。
4. **错误映射**：将 Agent 的错误码/字段转换为本文件列出的统一格式，便于小程序端处理。
5. **环境变量**：在服务器环境新增 `AGENT_API_BASE_URL`（Agent 服务地址）与可选的 `AGENT_API_TOKEN`（Bearer Token），由中转层统一注入鉴权信息。

### 3.2 Admin 规则操作页面

1. **页面位置**：在管理端新增 `app/(admin)/rules` 路由，包含规则列表、编译检查、手动触发 run（调用 `/rules/run`）、查看运行历史（`/runs`）、查看 Agent 列表（`/agents`）。
2. **数据拉取**：前端通过我们自己的 API 中转访问 Agent，使用 SWR/React Query 做缓存；保持统一的权限校验与错误提示。
3. **数据库**：当前需求不新增 Prisma 模型；若后续需要自定义规则模板，再考虑扩展 `schema.prisma`。

### 3.3 范围说明

- `docs/aiapi.md` 中“rule 到达执行时机自动调用 `/rules/run`”属于外部调度系统，本项目只需提供触发入口，无需实现定时任务。
- 重点工作是：补齐小程序端 API 中转与 Admin 操作界面，利用现有 Agent 接口完成业务闭环。

### 2.2 获取未处理任务列表

获取到多个未处理任务

#### 接口信息

- **URL**: `/api/task/uncompleted`
- **方法**: `GET`
- **认证**: 需要 Bearer Token

#### 请求头

```
  Authorization: Bearer <accessToken>
```

#### 返回结果

```json
[
  {
    "taskName": "爱",
    "taskId": "12345",
    "completedAt": "",
    "status": "未完成",
    "processedBy": "",
    "entries": [
      {
        "data": "爱",
        "source": "来源 A",
        "cantonesePronunciations": ["oi3", "ngoi3"],
        "phrases": ["爱心", "爱情"],
        "sentiments": [
          {
            "sentiment": "积极",
            "exampleSentences": ["我爱我的家人。", "她对生活充满爱。"]
          },
          {
            "sentiment": "消极",
            "exampleSentences": ["失去爱的人很痛苦。", "他感到孤独和无助。"]
          }
        ]
      },
      {
        "data": "爱",
        "source": "来源 B",
        "cantonesePronunciations": ["xx", "xx"],
        "phrases": ["xx", "xxx"],
        "sentiments": [
          {
            "sentiment": "xxx",
            "exampleSentences": ["xxxx", "xxxxx"]
          },
          {
            "sentiment": "xxx",
            "exampleSentences": ["xxx", "xxx"]
          }
        ]
      }
    ]
  }
]
```

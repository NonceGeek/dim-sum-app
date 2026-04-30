# Review App 标注审核小程序接口

## 概述

本文档描述 **Review App 标注审核小程序**专属的业务接口（任务相关），仅限标注员 (`TAGGER_PARTNER`、`TAGGER_OUTSOURCING`) 和研究员 (`RESEARCHER`) 调用。

> 通用基础接口（认证、用户信息、上传、错误处理等）请参见: [`../../api-reference.md`](../../api-reference.md)
> 认证流程与中间件说明请参见: [`../../authentication.md`](../../authentication.md)
> 业务流程、任务状态流转和权限规则请参见: [`./business-logic.md`](./business-logic.md)

### 基础信息

- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: JWT Bearer Token
- **生产环境**: `https://search.aidimsum.com/api`

---

## 一、任务接口

> 任务接口使用标注员认证 (`requireMiniprogramMarker`),允许角色: `TAGGER_PARTNER`、`TAGGER_OUTSOURCING`、`RESEARCHER`。
>
> **`actorRef` 与 `assigneeRef` 的区别**:
> - `actorRef`: 当前调用接口的用户 ID,用于权限控制和审计,由服务端从 Token 中获取,前端无需传递
> - `assigneeRef`: 要查看谁的任务列表,选填;不传时默认查看 `actorRef` 自己的任务

### 1.1 获取未完成任务列表

获取当前用户 (或指定标注员) 的未完成任务列表。

#### 接口信息

- **URL**: `/api/miniprogram/task/uncompleted`
- **方法**: `GET`
- **认证**: 需要 Bearer Token (标注员)

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `status` | string | 否 | `created,notified,in_progress,reassigning` | 任务状态,多个用逗号分隔 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `10` | 每页数量 |
| `assigneeRef` | string | 否 | - | 要查看谁的任务列表;不传时查看自己的任务 |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/task/uncompleted?page=1&pageSize=10',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { items, pagination } = response.data;
```

#### 成功响应 (200)

```json
{
  "items": [
    {
      "id": "task_001",
      "status": "created",
      "violationType": "pronunciation",
      "context": {
        "corpusName": "corpus_a",
        "corpusUniqueId": "unique_001",
        "sentenceText": "示例句子",
        "problemChar": "字"
      },
      "suggestions": [
        {
          "source": "lexicon",
          "value": "建议值",
          "lexiconBaseCorpusName": "base_corpus",
          "position": { "index": 0 },
          "explanation": "说明"
        }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "actorRef": "user_id",
      "processedBy": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 50
  }
}
```

#### 错误响应

**400 Bad Request** - 缺少用户标识

```json
{
  "error": "Missing user identifier"
}
```

---

### 1.2 获取已完成任务列表

获取当前用户 (或指定标注员) 的已完成任务列表。

#### 接口信息

- **URL**: `/api/miniprogram/task/completed`
- **方法**: `GET`
- **认证**: 需要 Bearer Token (标注员)

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `status` | string | 否 | `completed` | 任务状态 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `10` | 每页数量 |
| `assigneeRef` | string | 否 | - | 要查看谁的任务列表;不传时查看自己的任务 |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/task/completed?page=1&pageSize=10',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 成功响应 (200)

响应格式与 [1.1 获取未完成任务列表](#11-获取未完成任务列表) 相同。

---

### 1.3 获取任务列表 (通用)

获取当前用户 (或指定标注员) 的任务列表,支持按状态、语料库、违规类型等全量筛选条件查询。

> 与 1.1/1.2 的区别: 本接口不预设 `status` 默认值,所有筛选条件均由调用方自由传入,适合需要灵活组合查询的场景。

#### 接口信息

- **URL**: `/api/miniprogram/task/list`
- **方法**: `GET`
- **认证**: 需要 Bearer Token (标注员)

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|-------|------|-----|-------|------|
| `status` | string | 否 | - | 任务状态,多个用逗号分隔;不传则不过滤状态 |
| `page` | number | 否 | `1` | 页码 |
| `pageSize` | number | 否 | `10` | 每页数量 |
| `assigneeRef` | string | 否 | - | 要查看谁的任务列表;不传时查看自己的任务 |
| `corpusName` | string | 否 | - | 按语料库名称筛选 |
| `violationType` | string | 否 | - | 按违规类型筛选 |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

// 查询指定语料库下进行中的任务
const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/task/list?status=in_progress&corpusName=corpus_a&page=1&pageSize=20',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { items, pagination } = response.data;
```

#### 成功响应 (200)

响应格式与 [1.1 获取未完成任务列表](#11-获取未完成任务列表) 相同。

#### 错误响应

**400 Bad Request** - 缺少用户标识

```json
{
  "error": "Missing user identifier"
}
```

---

### 1.4 获取任务详情

根据任务 ID 获取单个任务的详细信息。

#### 接口信息

- **URL**: `/api/miniprogram/task/{id}`
- **方法**: `GET`
- **认证**: 需要 Bearer Token (标注员)

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `id` | string | 是 | 任务 ID |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: `https://search.aidimsum.com/api/miniprogram/task/${taskId}`,
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const task = response.data;
```

#### 成功响应 (200)

返回单个任务对象,结构见 [任务对象](#任务对象)。

#### 错误响应

**400 Bad Request** - 缺少任务 ID

```json
{
  "error": "Missing task id"
}
```

---

### 1.5 标记任务已查看

标记指定任务为已查看状态。

#### 接口信息

- **URL**: `/api/miniprogram/task/{id}/view`
- **方法**: `POST`
- **认证**: 需要 Bearer Token (标注员)

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `id` | string | 是 | 任务 ID |

#### 请求参数 (Body)

```json
{
  "actorRef": "string, 必填, 当前操作者的用户 ID"
}
```

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: `https://search.aidimsum.com/api/miniprogram/task/${taskId}/view`,
  method: 'POST',
  header: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  data: {
    actorRef: userId
  }
});
```

#### 错误响应

**400 Bad Request**

```json
{
  "error": "Missing task id"
}
```

```json
{
  "error": "Missing actorRef"
}
```

---

### 1.6 提交任务

提交任务的标注结果。

#### 接口信息

- **URL**: `/api/miniprogram/task/submit/{id}`
- **方法**: `POST`
- **认证**: 需要 Bearer Token (标注员)

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `id` | string | 是 | 任务 ID |

#### 请求参数 (Body)

```json
{
  "selected": ["array, 必填, 选中的标注结果数组"],
  "entries": ["array, 与 selected 二选一, 兼容旧字段"]
}
```

> `selected` 和 `entries` 二选一,优先使用 `selected`。数组不能为空。

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: `https://search.aidimsum.com/api/miniprogram/task/submit/${taskId}`,
  method: 'POST',
  header: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  data: {
    selected: [
      { "value": "标注结果1" },
      { "value": "标注结果2" }
    ]
  }
});
```

#### 错误响应

**400 Bad Request**

```json
{
  "error": "Missing task id"
}
```

```json
{
  "error": "entries or selected field is required"
}
```

```json
{
  "error": "Missing user identifier"
}
```

---

### 1.7 跳过/取消任务

跳过当前任务并重新分配给其他标注员。

#### 接口信息

- **URL**: `/api/miniprogram/task/cancel/{id}`
- **方法**: `POST`
- **认证**: 需要 Bearer Token (标注员)

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `id` | string | 是 | 任务 ID |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: `https://search.aidimsum.com/api/miniprogram/task/cancel/${taskId}`,
  method: 'POST',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 错误响应

**400 Bad Request**

```json
{
  "error": "Missing task id"
}
```

```json
{
  "error": "Missing user identifier"
}
```

---

### 1.8 获取任务统计

获取指定语料库的任务完成统计,支持按标注员筛选。

#### 接口信息

- **URL**: `/api/miniprogram/task/stats`
- **方法**: `GET`
- **认证**: 需要 Bearer Token (标注员)

#### 请求参数 (Query String)

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| `corpusName` | string | 是 | 语料库名称,多个名称用英文逗号分隔 |
| `assigneeRef` | string | 否 | 标注员 ID,多个 ID 用英文逗号分隔;不传则统计所有标注员 |

#### 请求示例

```javascript
const accessToken = wx.getStorageSync('accessToken');

const response = await wx.request({
  url: 'https://search.aidimsum.com/api/miniprogram/task/stats?corpusName=corpus_a,corpus_b',
  method: 'GET',
  header: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { summary, assignees } = response.data;
```

#### 成功响应 (200)

```json
{
  "filters": {
    "corpusIds": ["corpus_a", "corpus_b"],
    "assigneeRefs": ["user_001", "user_002"]
  },
  "summary": {
    "totalCount": 100,
    "processedCount": 60,
    "unprocessedCount": 40,
    "totalCorpusCount": 500,
    "completionRate": 0.6000
  },
  "assignees": [
    {
      "id": "user_001",
      "name": "张三",
      "avatar": "https://wx.qlogo.cn/..."
    },
    {
      "id": "user_002",
      "name": "李四",
      "avatar": null
    }
  ]
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|-----|------|-----|
| `filters.corpusIds` | string[] | 匹配到的语料库 ID 列表 |
| `filters.assigneeRefs` | string[] | 匹配到的标注员 ID 列表 |
| `summary.totalCount` | number | 符合筛选条件的任务总数 |
| `summary.processedCount` | number | 已完成的任务数 |
| `summary.unprocessedCount` | number | 未完成的任务数 |
| `summary.totalCorpusCount` | number \| null | 语料库中的记录总数,无法获取时为 null |
| `summary.completionRate` | number | 完成率 = processedCount / totalCount,保留 4 位小数 |
| `assignees` | array | 标注员用户信息列表 (由服务端根据 assigneeRefs 查询数据库补充) |
| `assignees[].id` | string | 用户 ID |
| `assignees[].name` | string \| null | 用户名 |
| `assignees[].avatar` | string \| null | 用户头像 URL |

#### 错误响应

**400 Bad Request** - 缺少必填参数

```json
{
  "error": "Missing required parameter: corpusName"
}
```

---

## 二、数据类型定义

### 任务对象

任务列表和详情接口返回的任务数据结构。

| 字段 | 类型 | 说明 |
|-----|------|-----|
| `id` | string | 任务 ID |
| `status` | string | 任务状态,见 [任务状态](#任务状态) |
| `violationType` | string | 违规类型 |
| `context` | object | 任务上下文 |
| `context.corpusName` | string | 语料库名称 |
| `context.corpusUniqueId` | string | 语料库唯一 ID |
| `context.sentenceText` | string | 句子文本 |
| `context.problemChar` | string | 问题字符 |
| `suggestions` | array | 建议列表 (可选) |
| `suggestions[].source` | string | 建议来源: `lexicon` 或 `llm` |
| `suggestions[].value` | string | 建议值 |
| `suggestions[].lexiconBaseCorpusName` | string | 词典基础语料库名称 (可选) |
| `suggestions[].position` | object | 位置信息 (可选) |
| `suggestions[].position.index` | number | 索引位置 |
| `suggestions[].explanation` | string | 说明 (可选) |
| `createdAt` | string | 创建时间 (ISO 8601) |
| `updatedAt` | string | 更新时间 (可选) |
| `completedAt` | string | 完成时间 (可选) |
| `actorRef` | string | 分配给的用户 ID (可选) |
| `processedBy` | string | 处理者 ID (可选) |

### 任务状态

| 值 | 说明 |
|----|------|
| `created` | 已创建 |
| `notified` | 已通知 |
| `in_progress` | 进行中 |
| `reassigning` | 重新分配中 |
| `completed` | 已完成 |
| `cancelled` | 已取消 |

---

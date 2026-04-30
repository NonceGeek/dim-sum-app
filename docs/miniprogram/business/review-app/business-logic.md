# Review App 标注审核业务逻辑

## 一、业务目标

Review App 标注审核小程序用于让标注员和研究员在移动端处理 agent 生成的语料审核任务。

核心目标：

- 查看分配给自己的待处理任务
- 按任务上下文和建议内容完成审核选择
- 标记任务已查看，便于任务状态追踪
- 提交任务结果或跳过任务
- 查看已完成任务和任务统计

当前小程序端不直接生成任务，任务由后端 agent 服务创建、分配和维护状态。小程序后端负责认证、权限控制、参数补充和代理调用 agent API。

---

## 二、用户与权限

Review App 使用标注员认证：

- 后端认证方法：`requireMiniprogramMarker`
- 允许角色：
  - `TAGGER_PARTNER`
  - `TAGGER_OUTSOURCING`
  - `RESEARCHER`

普通学习者 `LEARNER` 不能调用 Review App 任务接口。

服务端从 JWT Token 中读取当前用户：

| 字段 | 用途 |
|------|------|
| `userId` | 作为 `actorRef`，用于权限控制、任务查询和审计 |
| `role` | 判断是否允许访问任务接口 |
| `isSystemAdmin` | 当前任务接口不依赖该字段 |

---

## 三、系统边界

Review App 小程序后端是平台 API 与 agent 任务服务之间的适配层。

```text
微信小程序
  -> /api/miniprogram/task/*
  -> miniprogram JWT 鉴权
  -> 平台后端补充 actorRef / 参数校验
  -> agent task API
  -> 返回任务数据或操作结果
```

平台后端职责：

- 校验小程序登录态和角色权限
- 从 Token 获取当前用户 ID
- 解析分页、状态、筛选参数
- 调用 agent 任务服务
- 将 agent 错误透传为小程序可识别的 JSON 错误响应
- 在统计接口中补充标注员用户昵称和头像

agent 服务职责：

- 创建任务
- 分配任务
- 维护任务状态
- 保存任务完成结果
- 计算任务统计

---

## 四、任务数据模型

### 4.1 任务对象

小程序端主要消费的任务对象由 agent 服务返回。

核心字段：

| 字段 | 说明 |
|------|------|
| `id` | 任务 ID |
| `status` | 任务状态 |
| `violationType` | 违规或待审核类型 |
| `context` | 任务上下文 |
| `suggestions` | 建议结果列表 |
| `actorRef` | 当前分配对象或任务相关用户 |
| `processedBy` | 实际处理人 |
| `createdAt` | 创建时间 |
| `updatedAt` | 更新时间 |
| `completedAt` | 完成时间 |

### 4.2 任务上下文

`context` 用于帮助标注员判断任务。

常见字段：

| 字段 | 说明 |
|------|------|
| `corpusName` | 语料库名称 |
| `corpusUniqueId` | 语料唯一 ID |
| `sentenceText` | 原句文本 |
| `problemChar` | 问题字符 |
| `text` | 其他文本上下文 |

### 4.3 建议项

`suggestions` 是 agent 或词典给出的候选修正或判断依据。

常见字段：

| 字段 | 说明 |
|------|------|
| `source` | 建议来源，通常为 `lexicon` 或 `llm` |
| `value` | 建议值 |
| `lexiconBaseCorpusName` | 词典基础语料库 |
| `position.index` | 问题位置 |
| `explanation` | 建议解释 |

---

## 五、任务状态流转

任务状态由 agent 服务维护。小程序端根据状态筛选和触发操作。

| 状态 | 说明 |
|------|------|
| `created` | 已创建，尚未处理 |
| `notified` | 已通知标注员 |
| `in_progress` | 处理中 |
| `reassigning` | 重新分配中 |
| `completed` | 已完成 |
| `cancelled` | 已取消 |

常见流转：

```text
created / notified / in_progress / reassigning
  -> view
  -> in_progress
  -> submit
  -> completed
```

跳过或取消：

```text
created / notified / in_progress
  -> cancel
  -> reassigning 或 cancelled
```

具体最终状态以 agent 服务返回为准。

---

## 六、核心业务流程

### 6.1 获取未完成任务

```text
用户进入任务页
  -> 调用未完成任务接口
  -> 后端从 Token 获取 actorRef
  -> 默认查询 created,notified,in_progress,reassigning
  -> agent 返回任务列表
  -> 前端渲染任务卡片
```

默认筛选：

```text
status = created,notified,in_progress,reassigning
```

如果前端传 `assigneeRef`，则查询指定标注员的任务；不传时默认查看当前用户自己的任务。

### 6.2 获取已完成任务

```text
用户切换到已完成列表
  -> 调用已完成任务接口
  -> 默认 status = completed
  -> agent 返回已完成任务列表
```

用于用户回看历史处理结果。

### 6.3 获取通用任务列表

通用任务列表支持更灵活的筛选：

- `status`
- `assigneeRef`
- `corpusName`
- `violationType`
- `q`
- `page`
- `pageSize`

适合搜索、筛选、管理视图。

### 6.4 获取任务详情

```text
用户点击任务
  -> 调用任务详情接口
  -> agent 返回完整任务对象
  -> 前端展示上下文、建议项和操作区
```

### 6.5 标记任务已查看

```text
用户进入任务详情页
  -> 前端调用 view 接口
  -> agent 记录该任务已被查看
```

当前 `view` 接口请求体需要 `actorRef`。从业务一致性看，后续可以优化为完全由服务端从 Token 中补充，减少前端传用户 ID。

### 6.6 提交任务

```text
用户选择一个或多个审核结果
  -> 调用 submit 接口
  -> 后端校验 selected / entries 非空
  -> 后端从 Token 获取 actorRef
  -> agent 保存处理结果
  -> 任务进入 completed 或 agent 返回的最终状态
```

提交字段：

| 字段 | 说明 |
|------|------|
| `selected` | 推荐字段，用户选中的审核结果数组 |
| `entries` | 旧字段兼容 |

后端优先使用 `selected`，如果没有则读取 `entries`。

### 6.7 跳过或取消任务

```text
用户无法判断或不适合处理当前任务
  -> 调用 cancel 接口
  -> 后端从 Token 获取 actorRef
  -> agent 执行 skip-and-reassign
```

业务含义是跳过当前任务并交给 agent 服务重新分配或取消。

### 6.8 获取任务统计

```text
用户进入统计页
  -> 按 corpusName 查询任务统计
  -> 可选 assigneeRef 筛选标注员
  -> agent 返回统计结果
  -> 平台后端根据 assigneeRefs 查询 User 表补充 name / avatar
  -> 前端展示完成率和标注员信息
```

统计接口中 `corpusName` 必填，多个语料库用英文逗号分隔。

---

## 七、actorRef 与 assigneeRef

### 7.1 actorRef

`actorRef` 表示当前调用接口的用户 ID。

业务用途：

- 权限校验
- 操作审计
- 标记是谁查看、提交、跳过任务

在大多数接口中，`actorRef` 由服务端从 Token 获取，前端不需要传。

### 7.2 assigneeRef

`assigneeRef` 表示要查看谁的任务列表。

业务用途：

- 标注员查看自己的任务
- 研究员或管理视角查看指定标注员任务
- 任务统计按标注员筛选

如果不传 `assigneeRef`，agent 服务默认按当前 `actorRef` 查询。

---

## 八、错误处理原则

Review App 接口错误分为三类：

### 8.1 小程序后端参数错误

由平台后端直接返回，例如：

- 缺少任务 ID
- 缺少用户标识
- 提交结果为空
- 缺少 `corpusName`

### 8.2 认证与权限错误

由小程序认证中间件返回：

- Token 缺失
- Token 无效或过期
- 当前用户角色无权限

### 8.3 agent 服务错误

由 `handleAgentApiError` 处理：

- agent 返回 JSON 时透传原始 JSON 和 HTTP 状态码
- agent 返回文本时包装为 `{ "error": "..." }`
- 未知异常返回对应 fallback message

---

## 九、后续优化建议

### 9.1 view 接口移除前端 actorRef

当前 `view` 接口仍要求前端传 `actorRef`。建议后续改为服务端从 Token 自动补充，和 submit/cancel 保持一致。

### 9.2 统一分页响应

任务列表接口已使用：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0
  }
}
```

后续新增列表接口应继续复用该结构。

### 9.3 增强统计维度

当前统计以语料库、标注员和完成率为主。后续可扩展：

- 按违规类型统计
- 按任务状态统计
- 按标注员处理速度统计
- 按任务来源批次统计

---

## 十、相关接口文档

接口请求、响应和错误码请参见：

- [`./api.md`](./api.md)

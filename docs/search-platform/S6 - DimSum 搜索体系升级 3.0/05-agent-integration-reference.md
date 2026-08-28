# 05 · Agent 方需求与参考契约

状态：供 Agent 方设计参考；最终以双方联调契约为准

## 一、Agent 方当前需要提供什么

最小能力：

1. 接收一条可回溯词条及当前有效分类树。
2. 在缺少二级分类时返回最多一个候选。
3. 返回结构化依据，不只返回自然语言结论。
4. 区分唯一明确、存在歧义、无法判断、不适用和输入被阻塞。
5. 返回工作流/模型版本和调用 ID，支持追溯。
6. 不直接修改 DimSum 数据库、不直接创建 AW 任务、不决定公开状态。
7. 相同 idempotency key 不重复执行或返回同一任务结果。

## 二、Fynn 提供给 Agent 的上下文

```json
{
  "jobId": "uuid",
  "idempotencyKey": "classification:entry-id:taxonomy-v3:content-hash",
  "entry": {
    "entryId": "uuid",
    "entryName": "骑楼建筑形制介绍",
    "originalText": "...",
    "sourceCorpus": {
      "key": "lingnan-architecture",
      "name": "岭南建筑资料库"
    },
    "sourceLocation": { "type": "page", "value": "P.42" },
    "contentAttribute": "cultural_knowledge",
    "primaryCategory": { "id": 1, "name": "建筑资料" },
    "existingTags": ["骑楼", "建筑形制"],
    "media": [
      { "type": "text", "transcript": null }
    ],
    "rightsStatus": "authorized"
  },
  "taxonomy": {
    "version": "s6-2026-08",
    "allowedSecondaryCategories": [
      { "id": 8, "name": "近代街区建筑", "description": "..." }
    ]
  },
  "callback": {
    "url": "https://.../api/internal/s6/agent-results",
    "expiresAt": "2026-08-28T00:00:00Z"
  }
}
```

Fynn 不发送：数据库密钥、未授权贡献者隐私、与判断无关的用户数据、内部服务令牌。

以下情况 Fynn 不调用 Agent：

- 原始资料已经提供有效分类；
- 原文严重残缺或 OCR 错误明显；
- 来源、内容属性或版权未确认；
- 一级分类缺失；
- 当前分类体系中不存在可选二级分类。

## 三、Agent 参考输出

```json
{
  "jobId": "uuid",
  "providerJobId": "agent-job-id",
  "status": "succeeded",
  "decision": "single_candidate",
  "candidate": {
    "categoryId": 8,
    "categoryName": "近代街区建筑"
  },
  "evidence": [
    {
      "sourceField": "originalText",
      "quote": "常见于近代广州、佛山商埠街区",
      "start": 26,
      "end": 42
    }
  ],
  "rationale": "内容核心描述近代商埠街区中的骑楼形制。",
  "routeRecommendation": "pending_sample",
  "confidence": 0.91,
  "workflowVersion": "classification-s6-v1"
}
```

`decision`：

| 值 | 含义 | Fynn 默认处理 |
|---|---|---|
| single_candidate | 有一个明确候选 | pending_sample，按策略抽检 |
| ambiguous | 多个合理方向或规则冲突 | pending_review，创建确认任务 |
| insufficient_evidence | 信息不足 | empty 或 needs_info |
| not_applicable | 不适用分类体系 | empty，不建任务 |
| blocked | 输入/来源/权利问题 | 内容 needs_info |

`confidence` 仅作为内部质量分析字段，不公开展示，也不单独决定是否自动入库。Fynn 根据结构化 decision、规则和策略版本作最终路由。

## 四、异步接口参考

### Fynn → Agent

```http
POST {AGENT_API_BASE_URL}/v1/jobs/classification
Authorization: Bearer ...
Idempotency-Key: ...
```

接受响应：

```json
{
  "accepted": true,
  "providerJobId": "..."
}
```

### Agent → Fynn

```http
POST /api/internal/s6/agent-results
X-Agent-Timestamp: ...
X-Agent-Signature: ...
Idempotency-Key: ...
```

Fynn 验证：

- jobId 是否存在且未终结；
- timestamp 是否在允许窗口内；
- 签名和 body hash；
- categoryId 是否属于本次 taxonomy snapshot；
- evidence quote 是否能在对应输入字段中定位；
- 回调是否重复或结果互相冲突。

## 五、Fynn 验证后的处理

1. Agent 服务继续保存原始 run/task 记录；Fynn 不在契约确认前复制完整响应表。
2. 非法 category/evidence 拒绝业务写回，不进入正式分类。
3. 合法候选先保留在 Agent 任务或后续确认的一张轻量本地分类状态表中，不写入正式 `corpus_category`。
4. `pending_sample` 根据来源、内容类型和策略版本决定是否进入现有 Agent task 抽检队列。
5. `pending_review` 通过现有 Agent task 服务供 AW 标注小程序处理，不新建平行任务表或 outbox。
6. `confirmed` 后由 Fynn 服务写入正式 `corpus_category`；`empty` 不创建无意义任务。
7. 所有步骤共享 traceId/jobId，便于跨系统定位。

## 六、可靠性要求

- Agent 接受任务接口目标可用性不低于 99.5%。
- 正常请求 30 秒内返回异步 accepted；实际推理通过回调完成。
- Fynn 对 429/5xx 使用指数退避，最多自动重试 3 次。
- 回调至少一次投递，Fynn 必须幂等。
- Agent 输出大小建议不超过 256 KB。
- 依据引用总长度受限，避免复制整篇原文。

## 七、联调样例集

双方至少共同维护以下样例：

- 唯一明确分类。
- 两个合理分类。
- OCR 严重错误。
- 来源未确认。
- 现有体系不适用。
- Agent 返回不存在的 categoryId。
- 重复回调。
- taxonomy 版本过期。
- Agent 超时和失败重试。

最终 Agent 方若提出不同传输协议，只要保持本文件的字段语义、权限边界、幂等和审计要求，可以替换接口形式。

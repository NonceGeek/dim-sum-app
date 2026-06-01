# 语料采集投稿小程序 API

| 用途          | 路径                                | 形态    | 用途                        |
|-------------|-----------------------------------|-------|---------------------------|
| A. 投稿前安全检查  | `POST /precheck/submissions`      | 同步、单条 | 用户提交时实时过滤色情/政治/暴恐         |
| B. 投稿 AI 审核 | `POST /reviews/batches` + Webhook | 异步、批量 | 运营批量送审                    |
| C. 活动封面图生成  | `POST /covers/generations`        | 同步、单条 | 文本 prompt → 4 张 16:9 候选封面 |
| D. 语音转文字    | `POST /transcriptions`            | 同步、单条 | 一段音频 → 转写文本               |

---

## A. 投稿提交时的安全检查

`POST /precheck/submissions`

为了快速响应，**只检测 text + images**。即便传 `audio / video` 也会忽略。

### 请求

```jsonc
{
  "title":  "月光光",                    // 必填
  "intro":  "粤语童谣经典作品...",        // 必填
  "images": ["https://oss/.../1.jpg"]   // 必填，≤ 9 公网可以访问的 URL
}
```

### 响应 200

```jsonc
{
  "verdict": "pass",                     // pass | reject
  "details": {
    "text":   { "verdict": "pass", "riskLevel": "none", "labels": [] },
    "images": [
      { "index": 0, "verdict": "pass", "riskLevel": "none", "labels": [] }
    ]
  }
}
```

### Verdict 处置

| `verdict` | 动作     |
|-----------|--------|
| `pass`    | 进入运营队列 |
| `reject`  | 提示用户违规 |

`labels[]` 透传上游标签。已知的三类前缀：`pornographic_*` / `political_*` / `violent_*`

### 错误

| HTTP | error               | 说明                |
|------|---------------------|-------------------|
| 400  | `invalid_payload`   | 字段缺失 / images > 9 |
| 400  | `invalid_media_url` | image URL 无效      |
| 401  | `unauthorized`      | 鉴权失败              |
| 502  | `all_unknown`       | 上游全部失败，建议稍后重试     |

---

## B. 投稿 AI 审核

异步：平台 `POST` 提交批次（≤ 100 条），每条投稿审完就会推一次 Webhook，整批结束再推一次。

### B1 提交批次

`POST /reviews/batches`

```jsonc
{
  "batchExternalId": "platform-batch-xxx",             // 幂等键
  "callbackUrl":     "https://platform/webhooks/yue-review",
  "context": {                                         // 选填：本批次的评估锚点
    "theme":      "粤语童谣月光光主题征集",                // 活动主题
    "guidelines": "鼓励含广府传统意象、夜晚月亮元素"         // 选填，可以在运营批量发起 AI 审核的时候补充一点要求或者背景
  },
  "submissions": [
    {
      "submissionExternalId": "sub-001",              // 可以根据平台内部的投稿 ID 生成
      "title":  "...",                                // 投稿的标题
      "intro":  "...",                                // 投稿的描述
      "images": ["https://oss/.../1.jpg"],            // ≤ 9 公网可以访问的 URL
      "audio":  "https://oss/.../a.mp3",              // 选填 ≤ 60s
      "video":  "https://oss/.../v.mp4"               // 选填 ≤ 30s
    }
  ]
}
```

**关于 `context`**：

- 仅作用于 `SubmissionResult.assessments.relevance` 维度，作为"相关性"的判定锚点
- 不传则按通用粤语语料价值兜底打分（不报错，但 relevance 分数参考意义有限）

**响应 201**：

```jsonc
{ "batchId": "01HXXXXX", "status": "queued", "submissionCount": 50 }
```

**幂等**：

- 相同 `batchExternalId` + 相同 payload + 相同 `callbackUrl` → 200 返回相同的 batchId；
- 相同 `batchExternalId` + payload 或 callback 不一致 → `409 idempotency_key_conflict`。

**错误**：

| HTTP | error                                                                                                                     |
|------|---------------------------------------------------------------------------------------------------------------------------|
| 400  | `invalid_payload` / `invalid_callback_url` / `invalid_media_url` / `invalid_context` / `duplicate_submission_external_id` |
| 401  | `unauthorized`                                                                                                            |
| 409  | `idempotency_key_conflict`                                                                                                |

### B2 查批次进度

`GET /reviews/batches/:id`

```jsonc
{
  "batchId":         "01HXXXXX",
  "batchExternalId": "platform-batch-xxx",
  "status":          "running",            // queued | running | completed | failed | cancelled
  "submissionCount": 50,
  "progress":        { "queued": 10, "processing": 4, "completed": 32, "failed": 4, "partial": 3 },
  "createdAt":  "...", "startedAt": "...", "finishedAt": null
}
```

`partial` 是 `completed` 的子集（也就是 `completed=true` 且 `isPartial=true` 的条数）。

### B3 查投稿明细

#### B3.1 分页列表

`GET /reviews/batches/:id/submissions?status=&page=1&pageSize=20`

```jsonc
{
  "items": [
    {
      "submissionId":         "...",
      "submissionExternalId": "sub-001",
      "ordinal":              0,
      "result":               { /* SubmissionResult，见 B5 */ }
     }
  ],
  "page": 1, "pageSize": 20, "total": 50
}
```

未结束的 submission，`result` 为 `null`。

#### B3.2 单条查询

`GET /reviews/batches/:id/submissions/:submissionExternalId`

```jsonc
{
  "submissionId":         "01HYYYYY",
  "submissionExternalId": "sub-001",
  "ordinal":              0,
  "result":               { /* SubmissionResult，见 B5 */ }   // 未结束时为 null
}
```

错误：

| HTTP | error                  | 说明                                   |
|------|------------------------|--------------------------------------|
| 404  | `batch_not_found`      | `batchId` 不存在                        |
| 404  | `submission_not_found` | batch 存在，但没有该 `submissionExternalId` |
| 401  | `unauthorized`         | 鉴权失败                                 |

### B4 Webhook

平台收到服务回调，header 含：

```
Authorization: Bearer <WEBHOOK_TOKEN>      # 与 API_KEY 是不同的 token
X-Event-Id:      <事件唯一 id，可以用于去重>
X-Batch-Id:      <batchId>
X-Submission-Id: <submissionId>            # 仅 submission.reviewed
```

**两类事件**：

```jsonc
// submission.reviewed — 每条审完就发
{
  "event":                "submission.reviewed",
  "batchId":              "01HXXXXX",
  "batchExternalId":      "platform-batch-xxx",
  "submissionId":         "01HYYYYY",
  "submissionExternalId": "sub-001",
  "result":               { /* SubmissionResult，见 B5 */ }
}

// batch.finished — 整批结束发一次（无论成功失败）
{
  "event":           "batch.finished",
  "batchId":         "01HXXXXX",
  "batchExternalId": "platform-batch-xxx",
  "status":          "completed",            // completed | failed
  "failureReason":   null,                   // failed 时出
  "summary":         { "total": 50, "completed": 43, "failed": 4, "partial": 3 }
}
```

**收到webhook的平台**：

- 必须返 `2xx`；非 2xx / 超时 8s 视为失败
- 可以通过 `X-Event-Id` 做幂等去重

### B5 SubmissionResult

```jsonc
{
  "submissionId":         "01HYYYYY",
  "submissionExternalId": "sub-001",
  "status":               "completed",         // completed | failed
  "isPartial":            false,
  "verdict":              "pass",              // pass | reject | review_needed | null
  "verdictReason":        "...",

  "assessments": {
    "relevance":    { "score": 0.9,  "note": "..." },                 // 相关性 score 0–1
    "completeness": { "score": 0.85, "issues": ["视频后 5 秒有杂音"] }, // 完整性
    "value":        { "score": 0.8,  "note": "..." },                 // 内容信息密度等价值指标
    "category": {
      "primary":    "故事",                       // 投稿类型：用语 | 诗歌 | 故事 | 标语 | 地名解说 | 歇后语
      "candidates": ["故事", "用语"]               // 假设可能也适合其他投稿分类的话
    }
  },

  "artifacts": {
    "audio":  { "transcript": "...", "durationSec": 58 },
    "video":  { "audioTranscript": "...", "visualSummary": "...", "durationSec": 28 },
    "images": [{ "index": 0, "ocrText": "...", "understanding": "..." }]
  },

  "failures": [
    { "stage": "image_ocr", "index": 2, "message": "图片下载超时" }
  ],

  "processedAt": "2026-04-25T03:14:00Z"
}
```

- **`status=completed` 时只看 `verdict`**：`pass` 通过、`reject` 可以拒绝、`review_needed` 走人工复核
- `isPartial=true` 表达某些部分因为各种原因（如调用外部 API 失败）信号不全，此时一定 `verdict=review_needed`
- `status=failed` → AI 处理彻底失败（payload 不可处理 / 评估持续失败 / 超时），`verdict=null`，走人工

---

## C. 活动封面图生成

`POST /covers/generations`

### 请求

```jsonc
{ "prompt": "粤语童谣月光光主题活动，温馨童趣，夜晚月亮与广府老建筑剪影" }
```

`prompt` 必填

### 响应 200

```jsonc
{
  "generationId": "gen-01HXXXXX",
  "images": [
    { "index": 0,
      "url": "https://dashscope-result-.../xxx.png?...",
      "expiresAt": "2026-04-28T03:14:00Z" }
  ],
  "size": "1696*960"
}
```

返回的是临时 URL，候选项选中作为封面以后可以重新下载下来上传到项目自己的 OSS 里面。返回最多 4 张候选图，挑能用的用即可。

---

## D. 语音转文字

`POST /transcriptions`

把一段音频转写成汉字文本，针对粤语优化（底层走 `qwen3-asr-flash`）。同步、单条。

### 请求

`audioUrl` 与 `audioBase64` **二选一**（同时给或都不给都报错）。

```jsonc
// 形态一：公网 URL（推荐，和本服务其它接口一致）
{
  "audioUrl": "https://oss/.../a.mp3"   // 公网可访问，扩展名用于推断格式
}
```

```jsonc
// 形态二：base64 直传（适合小程序录音免去先传 OSS）
{
  "audioBase64": "<裸 base64 或 data: URI>",
  "format":      "mp3"                   // base64 时必填，见下方说明
}
```

字段：

| 字段            | 必填             | 说明                                                                   |
|---------------|----------------|----------------------------------------------------------------------|
| `audioUrl`    | 与下二选一          | HTTPS 公网音频 URL                                                       |
| `audioBase64` | 与上二选一          | 音频 base64；可裸串，也可 `data:audio/<fmt>;base64,...`                       |
| `format`      | base64 时**必填** | 音频格式：`mp3` / `wav` / `m4a` / `aac` / `ogg` / `flac`。URL 形态可省（按扩展名推断） |

**为什么 base64 必须带 `format`**：base64 / `data:` URI 里没有扩展名可推断，必须显式声明，否则会被当成 mp3 解码出错。

**体积与时长上限**：

- `audioBase64` 软上限约 **15 MB 字符**（≈ 解码后 10 MB），超出 → `audio_too_large`。
- 真正的硬约束是模型 **~3 分钟**单段时长。压缩格式（mp3 / m4a，单声道 16 kHz）下，体积远不到上限；**不要传未压缩的高采样率 WAV
  **（1 分钟就可能撞 10 MB）。
- 60s 内的小程序录音（mp3/aac）base64 后约 1 MB，离任何上限都很远，直传完全够用。

### 响应 200

```jsonc
{
  "text":     "我哋今日去边度玩",   // 汉字转写
  "language": "yue"               // 模型识别的语种码，可能缺省（无法判定时不返回）
}
```

### 错误

| HTTP | error               | 说明                                                  |
|------|---------------------|-----------------------------------------------------|
| 400  | `invalid_payload`   | `audioUrl` / `audioBase64` 未二选一，或 base64 缺 `format` |
| 400  | `invalid_media_url` | `audioUrl` 拉取失败（接口会先预检可达性）                          |
| 400  | `audio_too_large`   | `audioBase64` 超过体积软上限                               |
| 401  | `unauthorized`      | 鉴权失败                                                |
| 502  | `upstream_failed`   | ASR 模型调用失败，建议稍后重试                                   |
| 504  | `upstream_timeout`  | 上游超时（默认 30s）                                        |

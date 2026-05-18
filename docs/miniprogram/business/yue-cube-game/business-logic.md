# 粤方块小游戏业务逻辑

## 一、业务目标

粤方块小游戏面向已登录小程序用户，提供三类粤语学习玩法：

| 题型 | mode | 目标 |
|------|------|------|
| 语境填空 | `context` | 在对话或句子语境中选择合适粤语词 |
| 识字辨音 | `sound` | 用户朗读语料句子，由 AI 给发音评分 |
| 传图识音 | `image` | 用户上传图片并用粤语描述，由 AI 判断图片、录音和粤语相关性 |

系统当前阶段重点是完成题目读取、AI 评分、答题记录留存和个人进度汇总。错题分析和个性化出题暂不实时执行，但会保留足够数据供后续分析使用。

---

## 二、用户与权限

所有小游戏接口使用普通小程序登录态：

- 认证方式：JWT Bearer Token
- 后端认证方法：`requireMiniprogramAuth`
- 允许角色：所有已登录用户，包括 `LEARNER`、`TAGGER_PARTNER`、`TAGGER_OUTSOURCING`、`RESEARCHER`

前端无需传 `user_id`，服务端从 Token 中读取当前用户 ID。

---

## 三、题库与数据来源

### 3.1 语境填空

语境填空题库由 yue-lint-agent 离线生成，再导入平台数据库。

数据库表：

- `game_scenes`：场景配置，语境填空使用 `game_type = 'cloze'`
- `game_cloze_questions`：语境填空离线题库，`scene` 存 `game_scenes.code`

业务读取规则：

- 只读取 `status = active` 的题目
- 场景列表读取 `game_scenes` 中 `game_type = 'cloze'` 且 `status = active` 的记录，并按 active 题数返回 `total`
- 抽题时按 `scene_id` 过滤，`scene_id` 对应 `game_scenes.code`；没有传 `scene_id` 时从所有 active 场景下的 active 题中随机抽取

题目 payload 核心结构：

```json
{
  "stemPre": "我哋去茶餐厅，叫咗一份",
  "stemPost": "同埋一杯冻奶茶",
  "answer": "西多士",
  "answerIndex": 0,
  "options": [
    { "text": "西多士", "jyutping": "sai1 do1 si2" },
    { "text": "云吞面", "jyutping": "wan4 tan1 min6" }
  ],
  "explanation": "西多士是经典茶餐厅食物，与下文「冻奶茶」语境匹配"
}
```

### 3.2 识字辨音

识字辨音不单独生成题库，直接读取平台语料库。

数据库表：`cantonese_corpus_all`

固定筛选条件：

```sql
category = 'yywj2'
```

业务读取字段：

| 返回字段 | 来源 |
|----------|------|
| `id` | 优先使用 `unique_id`，没有则用内部 `id` |
| `question` | `data` |
| `meaning` | 优先从 `note.context.meaning`、`note.meaning`、`structured_note` 等字段读取 |
| `jyutping` | 优先从 `note.context.jyutping`、`note.jyutping`、`structured_note` 等字段读取 |
| `audio` | 优先从 `note.context.audio`、`note.audio`、`structured_note` 等字段读取 |

字段解析采用兼容策略：优先读 `note.context`，再兜底 `note` 和 `structured_note`，避免历史语料 JSON 结构不完全一致导致题目不可用。

### 3.3 传图识音

传图识音没有固定题库。用户选择或进入某个场景后：

1. 上传图片
2. 调用图片审核
3. 审核通过后录音
4. 调用图音联合评分
5. 记录答题结果

---

## 四、核心流程

### 4.1 语境填空流程

```text
前端选择题型 context
  -> 获取场景列表
  -> 获取语境填空题目
  -> 用户选择答案
  -> 提交答案
  -> 后端读取题目 payload 判题
  -> 写入 game_answer_records
  -> 更新 game_player_progress
  -> 返回正确答案和判题结果
```

判题规则：

- 优先使用 `selected_index` 与 `answerIndex` 对比
- 如果没有 `selected_index`，则使用 `selected_answer` 与 `answer` 对比
- 兼容旧字段 `answer`，但不推荐继续使用

### 4.2 识字辨音流程

```text
前端选择题型 sound
  -> 获取识字辨音题目
  -> 用户朗读并上传录音
  -> 提交答案
  -> 后端读取原题 text / jyutping / reference audio
  -> 调用 AI 识字辨音评分 API
  -> 写入 game_answer_records
  -> 更新 game_player_progress
  -> 返回 score / comment / is_correct
```

AI 服务：

```text
POST /games/audio-rate/score
```

请求参数由平台后端组装：

| 字段 | 来源 |
|------|------|
| `scene` | 题目 `scene_id` |
| `text` | 题目原文 |
| `jyutping` | 题目粤拼 |
| `userAudioUrl` | 用户上传录音 |
| `referenceAudioUrl` | 语料示范音频 |

判定规则：

```text
is_correct = score >= 60
```

若题目缺少示范音频或粤拼，接口返回 `422`，前端应跳过该题或提示换题。

### 4.3 传图识音流程

```text
用户上传图片
  -> 调用图片审核 API
  -> 审核通过后用户录音
  -> 调用图音联合评分 API
  -> 后端记录图片、录音、AI 三维评分结果
  -> 更新 game_player_progress
  -> 返回 overallPass / dimensions / comment
```

图片审核 AI 服务：

```text
POST /moderation/image
```

图音联合评分 AI 服务：

```text
POST /games/picvoice/review
```

联合评分维度：

| 维度 | 含义 |
|------|------|
| `audioActive` | 录音里是否有有效语音 |
| `isCantonese` | 录音是否更像粤语 |
| `imageAudioMatch` | 录音内容是否与图片场景相关 |

通过规则由 AI 服务返回：

```text
overallPass = audioActive.pass && isCantonese.pass && imageAudioMatch.pass
```

平台后端把 `overallPass` 作为 `is_correct` 写入答题记录。

---

## 五、数据写入规则

### 5.1 答题流水

每次有效提交都会写入 `game_answer_records`。

记录内容：

| 字段 | 说明 |
|------|------|
| `user_id` | 当前登录用户 |
| `mode` | `context` / `sound` / `image` |
| `question_id` | 题目 ID，传图识音可为空 |
| `scene` | 场景 |
| `selected_answer` | 用户选择答案文本 |
| `selected_index` | 用户选择答案下标 |
| `is_correct` | 是否答对或是否通过评分 |
| `time_spent_seconds` | 答题耗时 |
| `audio_url` | 用户录音 URL |
| `image_url` | 用户图片 URL |
| `score` | AI 分数，主要用于识字辨音 |
| `agent_result` | AI 原始返回结果 |
| `created_at` | 记录创建时间 |

该表是后续分析的事实来源，不做覆盖更新。

### 5.2 个人进度汇总

每次写入 `game_answer_records` 后，同一个事务内更新 `game_player_progress`。

汇总字段：

| 字段 | 说明 |
|------|------|
| `total_time_seconds` | 累计答题耗时 |
| `completed_questions` | 累计完成题数 |
| `correct_questions` | 累计正确题数 |
| `graded_questions` | 累计已判分题数 |
| `accuracy` | `correct_questions / graded_questions` |
| `level` | 当前等级 |
| `current_streak_days` | 当前连续打卡天数 |
| `last_played_date` | 最近游戏日期 |
| `context_completed` | 语境填空完成数 |
| `sound_completed` | 识字辨音完成数 |
| `image_completed` | 传图识音完成数 |
| `context_correct` | 语境填空正确数 |
| `sound_correct` | 识字辨音正确数 |
| `image_correct` | 传图识音正确数 |

更新方式：

- 如果用户没有汇总记录，则创建
- 如果已有汇总记录，则增量更新
- 流水写入和汇总更新放在同一个数据库事务中

---

## 六、进度与等级规则

### 6.1 今日进度

今日进度接口返回：

| 字段 | 计算方式 |
|------|----------|
| `completed_questions` | 当天 `game_answer_records` 数量 |
| `today_progress` | `completed_questions / 10`，最大为 `1` |
| `consecutive_days` | 当天玩过时读取 `game_player_progress.current_streak_days`，否则为 `0` |

当前每日目标固定为 `10` 题。

### 6.2 个人总进度

个人游戏数据接口直接读取 `game_player_progress`：

| 返回字段 | 来源 |
|----------|------|
| `total_time` | `total_time_seconds` |
| `completed_questions` | `completed_questions` |
| `accuracy` | `accuracy` |
| `level` | `level` |

如果用户还没有任何记录，则返回默认值：

```json
{
  "total_time": 0,
  "completed_questions": 0,
  "accuracy": 0,
  "level": "none"
}
```

### 6.3 等级规则

等级由连续活跃天数和累计完成题数共同决定。当前小游戏服务没有单独记录登录流水，因此后端以 `game_player_progress.current_streak_days` 作为连续登录/活跃天数。

| 条件 | 展示等级 | 后端 `level` |
|------|----------|---------------|
| 连续 7 天活跃且累计完成 5 题 | 粤语青铜 | `A` |
| 连续 30 天活跃且累计完成 20 题 | 粤语铂金 | `B` |
| 连续 45 天活跃且累计完成 30 题 | 粤语钻石 | `C` |
| 连续 60 天活跃且累计完成 40 题 | 粤语王者 | `D` |

计算时按最高满足条件返回。若用户没有达到任何等级，或距离 `last_played_date` 已经连续 30 天未活跃，则等级归零，返回 `level = "none"`。

---

## 七、后续分析预留

当前版本不实时生成个性化错题，但数据结构已经支持后续分析：

### 7.1 用户薄弱点分析

可以基于 `game_answer_records` 分析：

- 用户在哪些 `mode` 上错误率高
- 用户在哪些 `scene` 上错误率高
- 语境填空中常选错的选项
- 识字辨音中低分句子的粤拼、词汇、声调特征
- 传图识音中失败原因集中在哪个维度

### 7.2 错题与相似题推荐

后续可以根据流水记录做：

- 同一用户错题复现
- 同场景相似题推荐
- 针对低分粤拼或词汇生成新题
- 按用户错误点生成个性化题包

### 7.3 题库运营反馈

可以统计题目层面的表现：

- 某题整体错误率异常高，可能题干或选项有问题
- 某个场景题量不足，需要补充题库
- 某批次题库表现不好，可按 `batch_tag` 回滚或下线

---

## 八、相关接口文档

接口请求、响应和错误码请参见：

- [`./api.md`](./api.md)

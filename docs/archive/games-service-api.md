# 粤语小游戏 AI 服务 API

| 用途         | 路径                          | 形态    | 用途                             |
|------------|-----------------------------|-------|--------------------------------|
| A. 识字辨音评分  | `POST /games/audio-rate/score` | 同步、单条 | 用户朗读语料句子，AI 给发音评分 + 鼓励性评语      |
| B. 传图识音审核  | `POST /games/picvoice/review`  | 同步、单条 | 用户上传图片 + 录音，AI 做图音联合审核         |
| C. 通用图片审核  | `POST /moderation/image`       | 同步、单条 | 违规检测 + 清晰度评估，被 B 前置使用   |
| D. 语境填空题库   | 离线生成 → 平台数据库导入                | 离线、批量 | 由 yue-lint-agent 离线脚本生成，手工导入题库表 |

> 鉴权：`Authorization: Bearer <api-key>`。

---

## A. 识字辨音评分

`POST /games/audio-rate/score`

用户朗读语料里的目标句子，服务对照原文给一个 0-100 的总分和一句鼓励性评语。

### 请求

```jsonc
{
  "scene":             "饮食",                               // 必填，用户选择的场景
  "text":              "我想要一份西多士",                     // 必填，目标句原文
  "jyutping":          "ngo5 soeng2 jiu3 jat1 fan6 sai1 do1 si2", // 必填，目标句粤拼
  "userAudioUrl":      "https://platform-oss/.../user.mp3",  // 必填，用户朗读的音频
  "referenceAudioUrl": "https://platform-oss/.../ref.mp3"    // 必填，原文语料里的示范音频，作为对照
}
```

### 响应 200

```jsonc
{
  "score":     78,                                          // 0-100，整数
  "comment":   "整体很流畅，「多士」的「si2」可以再清脆一点，加油！"
}
```

### 评分大致区间

| 分数         | 含义     |
|------------|--------|
| 90 ~ 100   | 很棒    |
| 60 ~ 89    | 再接再厉 |
| < 60       | 偏离目标句 / 非粤语 / 录音质量过差，建议重读 |

> 服务在评分前会做一次 ASR：若 ASR 转写与目标句差距过大（包括录的不是粤语、不是目标句、整段噪声等），直接给低分并提示重读。

### 错误

| HTTP | error               | 说明                        |
|------|---------------------|---------------------------|
| 400  | `invalid_payload`   | 字段缺失 / 类型不符               |
| 400  | `invalid_media_url` | `userAudioUrl` / `referenceAudioUrl` 拉取失败 |
| 401  | `unauthorized`      | 鉴权失败                      |
| 502  | `upstream_failed`   | ASR 或评分模型调用失败，建议稍后重试      |
| 504  | `upstream_timeout`  | 上游超时                      |

---

## B. 传图识音审核

`POST /games/picvoice/review`

用户上传一张图 + 一段录音，服务从「录音是否有效」「是否粤语」「图音是否相关」三个维度联合评估。

### 前置流程

平台传图识音游戏的标准流程：

1. 用户上传图片 → 平台先调 [`POST /moderation/image`](#c-通用图片审核)，违规 / 不清晰直接退回让用户重传。
2. 用户完成录音 → 平台再调 `POST /games/picvoice/review` 做图音联合评估。

### 请求

```jsonc
{
  "scene":    "饮食",                                  // 必填
  "imageUrl": "https://platform-oss/.../user.jpg",     // 必填
  "audioUrl": "https://platform-oss/.../user.mp3"      // 必填
}
```

### 响应 200

```jsonc
{
  "overallPass": false,
  "dimensions": {
    "audioActive":     {
      "pass":   false,
      "reason": "有效语音占比不足 30%"
    },
    "isCantonese":     {
      "pass":       false,
      "confidence": 0.4,
      "reason":     "更像普通话"
    },
    "imageAudioMatch": {
      "pass":   true,
      "score":  78,
      "reason": "图为茶餐厅，描述提到饮茶匹配"
    }
  },
  "comment": "录音里大部分是静音，请重新录制"
}
```

### overallPass 规则

```
overallPass = audioActive.pass && imageAudioMatch.pass && isCantonese.pass
```

### 维度说明

| 维度                | 含义               |
|-------------------|------------------|
| `audioActive`     | 录音里是否真的有有效语音     |
| `isCantonese`     | 录音是否更像粤语而非其他方言   |
| `imageAudioMatch` | 录音内容是否与图片场景相关    |

### 错误

| HTTP | error             | 说明                              |
|------|-------------------|---------------------------------|
| 400  | `invalid_payload`   | 字段缺失 / 类型不符                     |
| 400  | `invalid_media_url` | `imageUrl` / `audioUrl` 拉取失败    |
| 401  | `unauthorized`      | 鉴权失败                            |
| 502  | `upstream_failed`   | 多模态模型调用失败                       |
| 504  | `upstream_timeout`  | 上游超时（一般 > 30s）                  |

---

## C. 通用图片审核

`POST /moderation/image`

通用能力，不绑定具体游戏。同时跑「违规审核」+「清晰度评估」。

### 请求

```jsonc
{
  "imageUrl": "https://platform-oss/.../user.jpg"  // 必填
}
```

### 响应 200

```jsonc
{
  "pass":       true,
  "moderation": {
    "pass":   true,
    "labels": []                                    // 不通过时透传上游标签
  },
  "clarity": {
    "pass":  true,
    "score": 88                                     // 0-100
  },
  "comment": ""                                     // 不通过时给一句话提示，通过时为空串
}
```

### 通过规则

```
pass = moderation.pass && clarity.pass
```

### labels[] 已知前缀

`pornographic_*` / `political_*` / `violent_*`，由上游审核服务透传。

### 错误

| HTTP | error             | 说明              |
|------|-------------------|-----------------|
| 400  | `invalid_payload`   | 字段缺失 / 类型不符     |
| 400  | `invalid_media_url` | `imageUrl` 拉取失败 |
| 401  | `unauthorized`      | 鉴权失败            |
| 502  | `upstream_failed`   | 上游审核或多模态模型失败    |

---

## D. 语境填空题库

语境填空不对外提供 API endpoint。题目由 yue-lint-agent 离线生成后导入数据库表 `game_cloze_questions`，平台直接读这张表抽题展示。

### 表结构

```sql
CREATE TABLE game_cloze_questions (
  id                      BIGSERIAL    PRIMARY KEY,
  external_id             TEXT         NOT NULL UNIQUE,
  scene                   TEXT         NOT NULL,
  source_corpus_unique_id TEXT         NOT NULL,
  payload                 JSONB        NOT NULL,
  status                  TEXT         NOT NULL DEFAULT 'active',
  batch_tag               TEXT,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_game_cloze_questions_scene_active
  ON game_cloze_questions (scene)
  WHERE status = 'active';
```

业务读路径只看 `status = 'active'`，partial index 把 `hidden` / `deleted` 排除在索引外，体积更小、cache 命中率高。`scene` 作为唯一键列即可——命中范围后场景内行序不影响 `ORDER BY random()`，列场景的 `GROUP BY scene` 也能直接走这个索引。运营态 update 频率低，seq scan 即可，先不为它们加索引。

| 列                          | 类型           | 含义                                                                  |
|-----------------------------|--------------|---------------------------------------------------------------------|
| `id`                        | BIGSERIAL    | 主键，平台内部使用                                                           |
| `external_id`               | TEXT UNIQUE  | yue-lint-agent 侧的题目 id，用于幂等导入；前端可不展示                                |
| `scene`                     | TEXT         | 场景，如「饮食」「出行」，抽题按此过滤                                                 |
| `source_corpus_unique_id`   | TEXT         | 粤语万句原句 unique id；同一原句可挖不同词生成多道题，所以不加 UNIQUE |
| `payload`                   | JSONB        | 题目正文，结构见下                                                           |
| `status`                    | TEXT         | `active` 上架抽题 / `hidden` 暂时下线 / `deleted` 软删                        |
| `batch_tag`                 | TEXT         | 生成批次标记（如 `2026-04-28`）                                |
| `created_at`                | TIMESTAMPTZ  | 写入时间                                                                |

### `payload` 结构

```jsonc
{
  "stemPre":     "我哋去茶餐厅，叫咗一份",
  "stemPost":    "同埋一杯冻奶茶",
  "answer":      "西多士",
  "answerIndex": 0,
  "options": [
    { "text": "西多士", "jyutping": "sai1 do1 si2" },
    { "text": "云吞面", "jyutping": "wan4 tan1 min6" },
    { "text": "肠粉",   "jyutping": "coeng2 fan2" },
    { "text": "公仔面", "jyutping": "gung1 zai2 min6" }
  ],
  "explanation": "西多士是经典茶餐厅食物，与下文「冻奶茶」语境匹配"
}
```

| 字段                        | 含义                                                                       |
|---------------------------|--------------------------------------------------------------------------|
| `stemPre` / `stemPost`    | 题干在挖空处前后的两段。前端自己拼空位渲染（`{stemPre}<Blank/>{stemPost}`）    |
| `answer`                  | 正确选项的文本，等于 `options[answerIndex].text`                                     |
| `answerIndex`             | 正确选项下标，范围 0–3                                                              |
| `options`                 | 4 个选项，每项含 `text` + `jyutping`（粤拼）。正确项粤拼来自原原语料切片，干扰项由 ToJyutping 生成 |
| `explanation`             | 对正确答案的一句话解释                                                          |

### 平台读取

业务读取路径是「先列场景 → 选定场景后随机抽题」，对应两条 SQL：

```sql
-- 1. 列出所有有上架题的场景（顺带返回每场景题数）
SELECT scene, COUNT(*) AS question_count
  FROM game_cloze_questions
 WHERE status = 'active'
 GROUP BY scene
 ORDER BY scene;

-- 2. 场景内随机抽 N 题
SELECT id, source_corpus_unique_id, payload
  FROM game_cloze_questions
 WHERE scene = $1 AND status = 'active'
 ORDER BY random() LIMIT $2;
```

### 运营 SQL

```sql
-- 单题下线
UPDATE game_cloze_questions SET status = 'hidden' WHERE external_id = $1;

-- 按原句批量下线（原句被发现有错时）
UPDATE game_cloze_questions SET status = 'hidden'
 WHERE source_corpus_unique_id = $1;

-- 整批回滚
UPDATE game_cloze_questions SET status = 'deleted' WHERE batch_tag = $1;
```

---

## 获取当日游戏进度

```
GET /game/today_progress
```

**Response:**

```json
{
  "today_progress": 0.0,
  "consecutive_days": 0,
  "completed_questions": 0
}
```

| 字段                | 类型  | 说明                       |
| ------------------- | ----- | -------------------------- |
| today_progress      | float | 今日完成进度 (0.00 ~ 1.00) |
| consecutive_days    | int   | 连续打卡天数               |
| completed_questions | int   | 今日完成题数               |

---

## 获取个人游戏数据

```
GET /game/player_progress
```

**Response:**

```json
{
  "total_time": 0,
  "completed_questions": 0,
  "accuracy": 0.0,
  "level": "string"
}
```

| 字段                | 类型   | 说明                 |
| ------------------- | ------ | -------------------- |
| total_time          | int    | 总游戏时长（秒）     |
| completed_questions | int    | 完成题数             |
| accuracy            | float  | 正确率 (0.00 ~ 1.00) |
| level               | string | 等级                 |

---

## 获取题型场景列表

```
GET /game/question_scenes?mode={mode}
```

**参数：**

| 参数 | 类型   | 说明                                                                  |
| ---- | ------ | --------------------------------------------------------------------- |
| mode | string | 题型：`context`（语境填空）、`image`（传图识音）、`sound`（识字辨音） |

**Response:**

```json
{
  "id": "string",
  "scene": "string",
  "total": 10
}
```

| 字段  | 类型   | 说明                                     |
| ----- | ------ | ---------------------------------------- |
| id    | string | 场景 ID，根据id设定前端对应的icon显示    |
| scene | string | 场景名称                                 |
| total | int    | 该场景下的总题数（`sound` 题型无此字段） |

---

## 获取语境填空题目(批量获取)

```
GET /game/question_context
```

**Response:**

```json
[
  {
    "id": "string",
    "scene_id": "string",
    "question": [{ "role": "string", "content": "string" }],
    "options": [{ "text": "string", "pronunciation": "string" }],
    "answer": "string",
    "scenario": "string"
  }
]
```

| 字段     | 类型   | 说明                                        |
| -------- | ------ | ------------------------------------------- |
| id       | string | 题目 ID                                     |
| scene_id | string | 场景 ID                                     |
| question | array  | 对话内容，role 为角色名，content 为对话     |
| options  | array  | 选项列表，text 为文字，pronunciation 为发音 |
| answer   | string | 正确答案                                    |
| scenario | string | 具体场景描述，如"茶餐厅"                    |

---

## 获取识字辨音题目(批量获取)

```
GET /game/question_sound
```

**Response:**

```json
[{
  "id": "string",
  "scene_id": "string",
  "question": "string",
  "meaning": "string",
  "audio": "string"
}]
```

| 字段     | 类型   | 说明                   |
| -------- | ------ | ---------------------- |
| id       | string | 题目 ID                |
| scene_id | string | 场景 ID                |
| question | string | 题目文字               |
| meaning  | string | 普通话释义             |
| audio    | string | 音频 URL|

---

## 提交答案(逐条提交)

```
POST /game/submit_answer
```

**Body:**

```json
{
  "question_id": "string",
  "answer": "boolean",
  "time": 10,
  "audio": "string"
}
```

| 参数        | 类型    | 必填 | 说明                     |
| ----------- | ------- | ---- | ------------------------ |
| question_id | string  | 是   | 题目 ID                  |
| answer      | boolean | 否   | 用户答案（语境填空使用） |
| time        | int     | 是   | 答题耗时（秒）           |
| audio       | string  | 否   | 音频 URL（识字辨音使用） |

**Response:**

```json
{
  "success": true,
  "message": "提交成功"
}
```

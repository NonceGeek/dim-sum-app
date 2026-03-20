# AI Dimsum API 文档

基础 URL: `https://backend.aidimsum.com`

测试 URL: `https://beta.backend.aidimsum.com`

## 目录
- [公开 API](#公开-api)
  - [V2 API](#v2-api)
  - [获取语料数量 (V2)](#12-获取语料数量-v2)
- [开发者 API（需要 API Key）](#开发者-api需要-api-key)
- [管理员 API（需要密码）](#管理员-api需要密码)
  - [OSS 上传 API](#22-获取-oss-上传策略管理员)

## 获取 API KEY

[点击填写信息获取API Key](https://wcn3glqwz3m6.feishu.cn/share/base/form/shrcnMOPUTn1f97EpPSinEIex7d)

## 公开 API

### 1. 健康检查
**GET** `/`

返回一个简单的健康检查消息。

**响应：**
```json
{
  "result": "Hello, Devs for AI Dimsum!"
}
```

**Curl 示例：**
```bash
curl -X GET "https://backend.aidimsum.com/"
```

---

### 2. 获取 API 文档（Markdown）
**GET** `/docs`

以 Markdown 格式返回 API 文档。

**响应：**
返回 API 文档的原始 Markdown 文本。

**Curl 示例：**
```bash
curl -X GET "https://backend.aidimsum.com/docs"
```

---

### 3. 获取 API 文档（HTML）
**GET** `/docs/html`

返回使用 GitHub 风格 Markdown 样式渲染的 HTML 版 API 文档。

**响应：**
返回一个完整格式化的 HTML 页面，包含 API 文档内容。

**Curl 示例：**
```bash
curl -X GET "https://backend.aidimsum.com/docs/html"
```

---

### 4. 获取主数据
**GET** `/main_data`

检索主语料数据表中的所有条目。

**响应：**
```json
[
  {
    "id": 1,
    "data": "main_data_content",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

**Curl 示例：**
```bash
curl -X GET "https://backend.aidimsum.com/main_data"
```

---

### 5. 获取语料应用
**GET** `/corpus_apps`

检索所有可用的语料应用。

**响应：**
```json
[
  {
    "id": 1,
    "name": "app_name",
    "description": "app_description"
  }
]
```

**Curl 示例：**
```bash
curl -X GET "https://backend.aidimsum.com/corpus_apps"
```

---

### 6. 获取语料分类
**GET** `/corpus_categories`

检索所有可用的语料分类。

**响应：**
```json
[
  {
    "id": 1,
    "name": "category_name",
    "description": "category_description"
  }
]
```

**Curl 示例：**
```bash
curl -X GET "https://backend.aidimsum.com/corpus_categories"
```

---

### 7. 获取指定语料分类 (V2)
**GET** `/v2/corpus_category`

按名称检索指定的语料分类。返回单个对象而非数组。

**参数：**
- `name`（必填）：分类名称

**响应：**
```json
{
  "id": 1,
  "name": "category_name",
  "description": "category_description"
}
```

**注意：** 如果未找到分类，返回空对象 `{}`。

**Curl 示例：**
```bash
curl -X GET "https://backend.aidimsum.com/v2/corpus_category?name=zyzd"
```

---

### 8. 文本搜索 (V2)
**GET** `/v2/text_search`

执行文本搜索，支持繁体和简体中文字符。此接口是 `/text_search_v2` 的别名。

**参数：**
- `keyword`（必填）：搜索关键词
- `table_name`（必填）：要搜索的表名
- `limit`（可选）：返回结果的最大数量

**响应：**
```json
[
  {
    "unique_id": "uuid",
    "data": "character",
    "note": {
      "meaning": ["definition1", "definition2"],
      "pinyin": ["pronunciation1", "pronunciation2"]
    },
    "category": "zyzd",
    "tags": ["word"]
  }
]
```

**Curl 示例：**

**方式一：使用双引号并进行 URL 编码：**
```bash
curl -X GET "https://backend.aidimsum.com/v2/text_search?keyword=%E7%82%BA&table_name=cantonese_corpus_all&limit=10"
```

**方式二：使用 --data-urlencode 配合 -G 标志（推荐用于复杂查询）：**
```bash
curl -G "https://backend.aidimsum.com/v2/text_search" \
  --data-urlencode "keyword=為" \
  --data-urlencode "table_name=cantonese_corpus_all" \
  --data-urlencode "limit=10"
```

**注意：** 对于中文字符，推荐使用方式二（--data-urlencode），因为它会自动处理编码。

---

### 9. 获取语料条目 (V2)
**GET** `/v2/corpus_item`

通过 unique_id 或 data 检索指定的语料条目。返回单个对象而非数组。

**参数：**
- `unique_id`（可选）：语料条目的唯一标识符
- `data`（可选）：语料条目的 data 字段

**注意：** 需要提供 `unique_id` 或 `data` 其中一个参数。

**响应：**
```json
{
  "unique_id": "uuid",
  "data": "character",
  "note": {
    "meaning": ["definition"],
    "pinyin": ["pronunciation"]
  },
  "category": "zyzd",
  "tags": ["word"]
}
```

**注意：** 如果未找到语料条目，返回空对象 `{}`。

**Curl 示例：**

**按 unique_id 搜索：**
```bash
curl -X GET "https://backend.aidimsum.com/v2/corpus_item?unique_id=your-uuid-here"
```

**按 data 搜索（中文字符）：**

**方式一：使用双引号并进行 URL 编码：**
```bash
curl -X GET "https://backend.aidimsum.com/v2/corpus_item?data=%E7%82%BA"
```

**方式二：使用 --data-urlencode 配合 -G 标志（推荐用于复杂查询）：**
```bash
curl -G "https://backend.aidimsum.com/v2/corpus_item" \
  --data-urlencode "data=為"
```

**注意：** 对于中文字符，推荐使用方式二（--data-urlencode），因为它会自动处理编码。

---

### 10. 获取随机语料条目
**GET** `/random_item`

从指定语料库中随机获取一个语料条目。

**参数：**
- `corpus_name`（必填）：要获取随机条目的语料库名称（例如 "zyzdv2"、"yyjq"）

**响应：**
```json
{
  "unique_id": "uuid",
  "data": "character",
  "note": {
    "meaning": ["definition1", "definition2"],
    "pinyin": ["pronunciation1", "pronunciation2"]
  },
  "category": "zyzd",
  "tags": ["word"]
}
```

**Curl 示例：**
```bash
curl -X GET "https://backend.aidimsum.com/random_item?corpus_name=zyzdv2"
```

### 11. 获取所有语料条目
**GET** `/all_items`

检索指定语料库中的所有语料条目。

**参数：**
- `corpus_name`（必填）：语料库名称（例如 "yyjq"）
- `cursor`（可选）：表示从该游标之后获取数据
- `limit`（可选）：返回结果的最大数量
- `lifecycle_stage`（可选）：按生命周期阶段筛选。支持通过重复参数或逗号分隔的方式传入多个值。

**lifecycle_stage 可用值：**
- `draft`：尚未进入任何处理流程
- `normalized`：自动化规范化已完成
- `cleaned`：人工清洗已完成
- `active`：已进入常规规则检查

**响应：**
```json
{
  data: [
    {
      id: 38551,
      data: 'fling嚟fling去打烂嘢。',
      note: [Object],
      category: 'yydh',
      created_at: '2026-02-02T12:46:40.750539+00:00',
      tags: [Array],
      editable_level: 1,
      liked_num: 0,
      unique_id: '6127a331-6bde-4a86-b8f7-37071576bc5a',
      bookmark_num: 0,
      view_num: 0,
      updated_at: '2026-02-26T01:27:56.313+00:00',
      lifecycle_stage: 'normalized',
      structured_note: [Object]
    },
    {
      id: 38552,
      data: 'hea埋呢段日子啊。',
      note: [Object],
      category: 'yydh',
      created_at: '2026-02-02T12:46:41.319881+00:00',
      tags: [Array],
      editable_level: 1,
      liked_num: 0,
      unique_id: 'b35514f3-46b8-4f2f-a376-c07b4b14a4e6',
      bookmark_num: 0,
      view_num: 0,
      updated_at: '2026-02-02T12:46:41.319881+00:00',
      lifecycle_stage: 'normalized',
      structured_note: [Object]
    },
    {
      id: 38553,
      data: '一個人都冇食㗎。你交咗解藥出嚟，我唔會傷害你。',
      note: [Object],
      category: 'yydh',
      created_at: '2026-02-02T12:46:41.645009+00:00',
      tags: [Array],
      editable_level: 1,
      liked_num: 0,
      unique_id: '0d581bc4-fdb8-4744-a4f0-5c9fb20e4474',
      bookmark_num: 0,
      view_num: 0,
      updated_at: '2026-02-02T12:46:41.645009+00:00',
      lifecycle_stage: 'normalized',
      structured_note: [Object]
    },
    {
      id: 38554,
      data: '一唔一齊玩啊？',
      note: [Object],
      category: 'yydh',
      created_at: '2026-02-02T12:46:41.945722+00:00',
      tags: [Array],
      editable_level: 1,
      liked_num: 0,
      unique_id: 'd8e6cc50-403c-48f6-8954-3b89de2b1894',
      bookmark_num: 0,
      view_num: 0,
      updated_at: '2026-02-02T12:46:41.945722+00:00',
      lifecycle_stage: 'normalized',
      structured_note: [Object]
    },
    {
      id: 38555,
      data: '一言为定，我等你啊。',
      note: [Object],
      category: 'yydh',
      created_at: '2026-02-02T12:46:42.241755+00:00',
      tags: [Array],
      editable_level: 1,
      liked_num: 0,
      unique_id: 'b12ccb2b-9580-409c-8b4c-61491612bf9b',
      bookmark_num: 0,
      view_num: 0,
      updated_at: '2026-02-26T00:44:39.712+00:00',
      lifecycle_stage: 'normalized',
      structured_note: [Object]
    },
    {
      id: 38556,
      data: '七色寶蓮保唔住你哋嘅肉身，不過好在保住個魂魄。',
      note: [Object],
      category: 'yydh',
      created_at: '2026-02-02T12:46:42.527305+00:00',
      tags: [Array],
      editable_level: 1,
      liked_num: 0,
      unique_id: '91982a32-4e7b-4d03-81f3-e454558cacd9',
      bookmark_num: 0,
      view_num: 0,
      updated_at: '2026-02-02T12:46:42.527305+00:00',
      lifecycle_stage: 'normalized',
      structured_note: [Object]
    },
    {
      id: 38557,
      data: '三年後嘅今日，天雷點都會降临，攞佢條命。',
      note: [Object],
      category: 'yydh',
      created_at: '2026-02-02T12:46:42.833872+00:00',
      tags: [Array],
      editable_level: 1,
      liked_num: 0,
      unique_id: 'ac5ef235-e255-436b-9587-df73190a3b66',
      bookmark_num: 0,
      view_num: 0,
      updated_at: '2026-02-25T06:44:53.962+00:00',
      lifecycle_stage: 'normalized',
      structured_note: [Object]
    },
    {
      id: 38558,
      data: '三年短係短咗啲。',
      note: [Object],
      category: 'yydh',
      created_at: '2026-02-02T12:46:43.106982+00:00',
      tags: [Array],
      editable_level: 1,
      liked_num: 0,
      unique_id: '913c9ed5-9554-4f2f-974a-126d79d08e3e',
      bookmark_num: 0,
      view_num: 0,
      updated_at: '2026-02-02T12:46:43.106982+00:00',
      lifecycle_stage: 'normalized',
      structured_note: [Object]
    },
    {
      id: 38559,
      data: '上次嘅误会已經澄清咗，係你打走咗只妖怪。',
      note: [Object],
      category: 'yydh',
      created_at: '2026-02-02T12:46:43.380224+00:00',
      tags: [Array],
      editable_level: 1,
      liked_num: 0,
      unique_id: 'a4636c9c-9d8c-4de0-817f-736c09a29747',
      bookmark_num: 0,
      view_num: 0,
      updated_at: '2026-02-02T12:46:43.380224+00:00',
      lifecycle_stage: 'normalized',
      structured_note: [Object]
    },
    {
      id: 38560,
      data: '上面呢？好簡單啫，嚇佢上條橋度，咪搞掂晒咯！點嚇啊？',
      note: [Object],
      category: 'yydh',
      created_at: '2026-02-02T12:46:43.683963+00:00',
      tags: [Array],
      editable_level: 1,
      liked_num: 0,
      unique_id: 'b34833f0-b39c-465c-b1c4-fa5ee1dec562',
      bookmark_num: 0,
      view_num: 0,
      updated_at: '2026-02-02T12:46:43.683963+00:00',
      lifecycle_stage: 'normalized',
      structured_note: [Object]
    }
  ],
  pagination: { limit: 10, cursor: '0', nextCursor: 38560, hasMore: true }
}
```

**Curl 示例：**
```bash
curl -X GET "https://backend.aidimsum.com/all_items?corpus_name=yyjq&cursor=0&limit=2"
```

**Curl 示例（筛选）：**
```bash
curl -X GET "https://backend.aidimsum.com/all_items?corpus_name=yyjq&lifecycle_stage=normalized&lifecycle_stage=draft"
```

### 12. 获取语料数量 (V2)
**GET** `/v2/corpus_count`

返回指定语料库中条目的总数，不返回实际数据。支持按 lifecycle_stage 筛选。

响应包含 `Cache-Control: public, max-age=300, stale-while-revalidate=600` 头部。

**参数：**
- `corpus_name`（必填）：语料库名称（例如 "yyjq"）
- `lifecycle_stage`（可选）：按生命周期阶段筛选。支持通过重复参数或逗号分隔的方式传入多个值。

**lifecycle_stage 可用值：**
- `draft`：尚未进入任何处理流程
- `normalized`：自动化规范化已完成
- `cleaned`：人工清洗已完成
- `active`：已进入常规规则检查

**响应：**
```json
{
  "corpus_name": "yyjq",
  "total_count": 12345,
  "lifecycle_stage": ["normalized", "cleaned"]
}
```

**Curl 示例：**
```bash
curl -X GET "https://backend.aidimsum.com/v2/corpus_count?corpus_name=yyjq"
```

```bash
curl -X GET "https://backend.aidimsum.com/v2/corpus_count?corpus_name=yyjq&lifecycle_stage=normalized,cleaned"
```

---

## 开发者 API（需要 API Key）

### 13. 创建语料条目（开发者）
**POST** `/dev/insert_corpus_item`

提交创建新语料条目的请求。需要已审批的 API Key。请求将处于待审批状态。

**请求体：**
```json
{
  "data": "example corpus text data",
  "note": {
    "field1": "value1",
    "field2": "value2"
  },
  "category": "example_category",
  "tags": ["tag1", "tag2", "tag3"],
  "api_key": "your-approved-api-key"
}
```

**成功响应：**
```json
{
  "message": "Update request submitted successfully",
  "history_id": 123,
  "status": "PENDING",
  "operation_type": "CREATE"
}
```

**Curl 示例：**
```bash
curl -X POST "https://backend.aidimsum.com/dev/insert_corpus_item" \
  -H "Content-Type: application/json" \
  -d '{
    "data": "example corpus text data",
    "note": {
      "field1": "value1",
      "field2": "value2"
    },
    "category": "example_category",
    "tags": ["tag1", "tag2", "tag3"],
    "api_key": "your-approved-api-key"
  }'
```

---

### 14. 更新语料条目（开发者）
**POST** `/dev/update_corpus_item`

提交更新现有语料条目的请求。需要已审批的 API Key。请求将处于待审批状态。

**请求体：**
```json
{
  "uuid": "example-uuid-here",
  "note": {
    "field1": "value1",
    "field2": "value2"
  },
  "structured_note": {
    "field1": "value1",
    "field2": "value2"
  },
  "api_key": "your-approved-api-key"
}
```

**成功响应：**
```json
{
  "message": "Update request submitted successfully",
  "unique_id": "example-uuid-here",
  "status": "PENDING"
}
```

**Curl 示例：**
```bash
curl -X POST "https://backend.aidimsum.com/dev/update_corpus_item" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "example-uuid-here",
    "note": {
      "field1": "value1",
      "field2": "value2"
    },
    "structured_note": {
      "field1": "value1",
      "field2": "value2"
    },
    "api_key": "your-approved-api-key"
  }'
```

---

### 15. 获取更新历史
**POST** `/dev/get_update_history`

通过 unique_id 检索指定语料条目的更新历史。需要已审批的 API Key。

**请求体：**
```json
{
  "unique_id": "example-unique-id-here",
  "api_key": "your-approved-api-key"
}
```

**成功响应：**
```json
[
  {
    "id": 1,
    "unique_id": "example-unique-id-here",
    "note": {},
    "status": "PENDING",
    "user_id": "user123",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

**Curl 示例：**
```bash
curl -X POST "https://backend.aidimsum.com/dev/get_update_history" \
  -H "Content-Type: application/json" \
  -d '{
    "unique_id": "example-unique-id-here",
    "api_key": "your-approved-api-key"
  }'
```

---

### 16. 审批语料条目（需要管理员 API Key）
**POST** `/dev/approve_corpus_item`

审批待处理的语料条目更新或创建请求。需要管理员级别的 API Key。

**请求体：**
```json
{
  "unique_id": "example-unique-id-here",
  "api_key": "admin-api-key-here"
}
```

**成功响应（创建操作）：**
```json
{
  "message": "Corpus item created successfully",
  "operation_type": "CREATE",
  "corpus_item": {
    "unique_id": "new-uuid",
    "data": "example data",
    "note": {},
    "category": "example_category",
    "tags": ["tag1"]
  }
}
```

**成功响应（更新操作）：**
```json
{
  "message": "Corpus item updated successfully",
  "operation_type": "UPDATE",
  "corpus_item": {
    "unique_id": "example-uuid",
    "data": "example data",
    "note": {},
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**错误响应（非待处理状态）：**
```json
{
  "error": "Update history status is not PENDING",
  "current_status": "APPROVED"
}
```

**Curl 示例：**
```bash
curl -X POST "https://backend.aidimsum.com/dev/approve_corpus_item" \
  -H "Content-Type: application/json" \
  -d '{
    "unique_id": "example-unique-id-here",
    "api_key": "admin-api-key-here"
  }' | jq
```

---

### 17. 获取 API Key 状态
**POST** `/dev/get_api_key_status`

检索您的 API Key 的状态和详细信息。

**请求体：**
```json
{
  "api_key": "your-api-key-here"
}
```

**成功响应：**
```json
{
  "id": 1,
  "user_id": "user123",
  "key": "\\x...",
  "status": "APPROVED",
  "type": "DEVELOPER",
  "called_times": 42,
  "created_at": "2024-01-01T00:00:00Z"
}
```

**Curl 示例：**
```bash
curl -X POST "https://backend.aidimsum.com/dev/get_api_key_status" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your-api-key-here"
  }'
```

---

### 18. 按语料库名称获取标注员
**POST** `/dev/get_taggers_by_corpus_name`

检索指定语料分类的标注员（参与标注的用户）详细信息。需要已审批的 API Key。

**请求体：**
```json
{
  "name": "corpus-name-here",
  "api_key": "your-api-key-here"
}
```

**成功响应：**
```json
{
  "id": 1,
  "name": "corpus-name",
  "description": "corpus description",
  "taggers": [
    {
      "id": "user-id-1",
      "name": "User Name",
      "email": "user@example.com",
      "accounts": [
        {
          "id": "account-id",
          "provider": "wechat",
          "providerAccountId": "openid"
        }
      ]
    }
  ]
}
```

**Curl 示例：**
```bash
curl -X POST "https://backend.aidimsum.com/dev/get_taggers_by_corpus_name" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "corpus-name-here",
    "api_key": "your-api-key-here"
  }' | jq
```

---

## 管理员 API（需要密码）

### 19. 插入语料条目（管理员）
**POST** `/admin/insert_corpus_item`

直接插入新的语料条目。需要管理员密码。

**请求体：**
```json
{
  "data": "character",
  "note": {
    "meaning": ["definition"],
    "pinyin": ["pronunciation"],
    "contributor": "admin"
  },
  "category": "zyzd",
  "tags": ["word"],
  "password": "admin-password"
}
```

**成功响应：**
```json
{
  "data": null,
  "error": null,
  "count": 1,
  "status": 201,
  "statusText": "Created"
}
```

**错误响应（未授权）：**
```json
{
  "error": "Unauthorized: Invalid password"
}
```

**Curl 示例：**
```bash
curl -X POST "https://backend.aidimsum.com/admin/insert_corpus_item" \
  -H "Content-Type: application/json" \
  -d '{
    "data": "新",
    "note": {
      "meaning": ["new", "fresh"],
      "pinyin": ["san1"],
      "contributor": "admin"
    },
    "category": "zyzd",
    "tags": ["word"],
    "password": "your-admin-password"
  }'
```

---

### 20. 更新语料条目（管理员）
**POST** `/admin/update_corpus_item`

直接更新现有的语料条目。需要管理员密码。

**请求体：**
```json
{
  "unique_id": "example_unique_id",
  "note": {
    "field1": "value1",
    "field2": "value2"
  },
  "category": "example_category",
  "tags": ["tag1", "tag2", "tag3"],
  "password": "your-admin-password"
}
```

**成功响应：**
状态码 204（无内容）表示更新成功。

**Curl 示例：**
```bash
curl -X POST "https://backend.aidimsum.com/admin/update_corpus_item" \
  -H "Content-Type: application/json" \
  -d '{
    "unique_id": "example_unique_id",
    "note": {
      "field1": "value1",
      "field2": "value2"
    },
    "category": "example_category",
    "tags": ["tag1", "tag2", "tag3"],
    "password": "your-admin-password"
  }'
```

---

### 21. 获取用户信息（管理员）
**POST** `/admin/get_user`

通过用户 ID 或邮箱检索用户信息。包含关联的账户信息。需要管理员密码。

**请求体：**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "password": "your-admin-password"
}
```

**注意：** 需要提供 `id` 或 `email` 其中一个参数。

**成功响应：**
```json
{
  "id": "user-id",
  "name": "User Name",
  "email": "user@example.com",
  "role": "LEARNER",
  "createdAt": "2024-01-01T00:00:00Z",
  "accounts": [
    {
      "id": "account-id",
      "provider": "wechat",
      "providerAccountId": "openid",
      "openId": "wechat-openid"
    }
  ]
}
```

**错误响应（用户未找到）：**
```json
{
  "error": "User not found"
}
```

**Curl 示例：**
```bash
curl -X POST "https://backend.aidimsum.com/admin/get_user" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "example_id",
    "email": "example_email",
    "password": "your-admin-password"
  }'
```

### 22. 获取 OSS 上传策略（管理员）
**POST** `/admin/oss/upload-policy`

生成预签名的上传策略，用于客户端直接上传到阿里云 OSS。需要管理员密码。

**请求体：**
```json
{
  "password": "your-admin-password",
  "bucket": "your-bucket-name",
  "dir": "upload/path/",
  "expireSeconds": 3600
}
```

**参数：**
- `password`（必填）：管理员密码
- `bucket`（必填）：OSS 存储桶名称
- `dir`（必填）：存储桶中的目录路径（应以 `/` 结尾）
- `expireSeconds`（可选）：策略过期时间（秒），默认 3600

**成功响应：**
```json
{
  "success": true,
  "data": {
    "accessId": "your-access-key-id",
    "policy": "base64-encoded-policy",
    "signature": "calculated-signature",
    "dir": "upload/path/",
    "host": "https://your-bucket.oss-cn-guangzhou.aliyuncs.com",
    "expire": 1704067200
  }
}
```

**Curl 示例：**
```bash
curl -X POST "https://backend.aidimsum.com/admin/oss/upload-policy" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "your-admin-password",
    "bucket": "dimsum-audio",
    "dir": "xiaozhupeiqi/xcpq/",
    "expireSeconds": 3600
  }'
```

---

### 23. 上传文件到 OSS（管理员）
**POST** `/admin/oss/upload`

通过服务器将文件直接上传到阿里云 OSS。需要管理员密码。使用 multipart/form-data 格式。

**请求体（FormData）：**
- `password`（必填）：管理员密码
- `bucket`（必填）：OSS 存储桶名称
- `dir`（必填）：存储桶中的目录路径（应以 `/` 结尾）
- `file`（必填）：要上传的文件

**成功响应：**
```json
{
  "success": true,
  "url": "https://dimsum-audio.oss-cn-guangzhou.aliyuncs.com/test/example.wav",
  "key": "test/example.wav"
}
```

**错误响应：**
```json
{
  "error": "Failed to upload to OSS",
  "details": "error message from OSS"
}
```

**Curl 示例：**
```bash
curl -X POST "https://backend.aidimsum.com/admin/oss/upload" \
  -F "password=your-admin-password" \
  -F "bucket=dimsum-audio" \
  -F "dir=xiaozhupeiqi/xcpq/" \
  -F "file=@./test.wav"
```

---

## 错误响应

所有接口可能返回以下错误响应：

### 400 请求错误
```json
{
  "error": "Bad request message"
}
```

### 401 未授权
```json
{
  "error": "Unauthorized: Invalid password"
}
```

### 403 禁止访问
```json
{
  "error": "API key not approved"
}
```

### 404 未找到
```json
{
  "error": "Resource not found"
}
```

### 500 服务器内部错误
```json
{
  "error": "Internal server error"
}
```

---

## 数据结构

### 语料条目结构
```json
{
  "unique_id": "uuid",
  "data": "character or word",
  "note": {
    "meaning": ["definition1", "definition2"],
    "pinyin": ["pronunciation1", "pronunciation2"],
    "contributor": "contributor_id",
    "page": 1,
    "number": "0001",
    "others": {
      "異體": [],
      "校訂註": null
    }
  },
  "category": "zyzd",
  "tags": ["word"],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### ZYZD 条目结构
```json
{
  "編號": "0005",
  "頁": 1,
  "字頭": ["為", "爲"],
  "義項": [
    {
      "釋義": "㈠①作～．事在人～。②能者～師．一分～二",
      "讀音": [
        {
          "粵拼讀音": "wai4",
          "讀音標記": null,
          "變調": null
        }
      ]
    }
  ],
  "_校訂補充": {
    "異體": [],
    "校訂註": null
  }
}
```

---

## 认证方式

### API Key 认证
对于开发者 API，在请求体中包含您的 API Key：
```json
{
  "api_key": "your-approved-api-key"
}
```

### 管理员密码认证
对于管理员 API，在请求体中包含管理员密码：
```json
{
  "password": "your-admin-password"
}
```

---

## 速率限制

目前没有实施明确的速率限制，但请合理使用 API。

---

## 支持

如有 API 相关的支持需求或问题，请联系开发团队。

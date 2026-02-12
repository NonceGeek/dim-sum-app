# AI Dimsum API Documentation

Base URL: `https://backend.aidimsum.com`

## Table of Contents
- [Public APIs](#public-apis)
  - [V2 APIs](#v2-apis)
- [Developer APIs (API Key Required)](#developer-apis-api-key-required)
- [Admin APIs (Password Required)](#admin-apis-password-required)
  - [OSS Upload APIs](#21-get-oss-upload-policy-admin)

## GET API KEY!

[点击填写信息获取API Key](https://wcn3glqwz3m6.feishu.cn/share/base/form/shrcnMOPUTn1f97EpPSinEIex7d)

## Public APIs

### 1. Health Check
**GET** `/`

Returns a simple health check message.

**Response:**
```json
{
  "result": "Hello, Devs for AI Dimsum!"
}
```

**Curl Example:**
```bash
curl -X GET "https://backend.aidimsum.com/"
```

---

### 2. Get API Documentation (Markdown)
**GET** `/docs`

Returns the API documentation in Markdown format.

**Response:**
Returns the raw markdown text of the API documentation.

**Curl Example:**
```bash
curl -X GET "https://backend.aidimsum.com/docs"
```

---

### 3. Get API Documentation (HTML)
**GET** `/docs/html`

Returns the API documentation rendered as HTML with GitHub Flavored Markdown styling.

**Response:**
Returns a fully formatted HTML page with the API documentation.

**Curl Example:**
```bash
curl -X GET "https://backend.aidimsum.com/docs/html"
```

---

### 4. Get Main Data
**GET** `/main_data`

Retrieves all items from the main corpus data table.

**Response:**
```json
[
  {
    "id": 1,
    "data": "main_data_content",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

**Curl Example:**
```bash
curl -X GET "https://backend.aidimsum.com/main_data"
```

---

### 5. Get Corpus Apps
**GET** `/corpus_apps`

Retrieves all available corpus applications.

**Response:**
```json
[
  {
    "id": 1,
    "name": "app_name",
    "description": "app_description"
  }
]
```

**Curl Example:**
```bash
curl -X GET "https://backend.aidimsum.com/corpus_apps"
```

---

### 6. Get Corpus Categories
**GET** `/corpus_categories`

Retrieves all available corpus categories.

**Response:**
```json
[
  {
    "id": 1,
    "name": "category_name",
    "description": "category_description"
  }
]
```

**Curl Example:**
```bash
curl -X GET "https://backend.aidimsum.com/corpus_categories"
```

---

### 7. Get Specific Corpus Category
**GET** `/corpus_category`

Retrieves a specific corpus category by name.

**Parameters:**
- `name` (required): The name of the category

**Response:**
```json
[
  {
    "id": 1,
    "name": "category_name",
    "description": "category_description"
  }
]
```

**Curl Example:**
```bash
curl -X GET "https://backend.aidimsum.com/corpus_category?name=zyzd"
```

---

### 7.1. Get Specific Corpus Category (V2)
**GET** `/v2/corpus_category`

Retrieves a specific corpus category by name. Returns a single object instead of an array.

**Parameters:**
- `name` (required): The name of the category

**Response:**
```json
{
  "id": 1,
  "name": "category_name",
  "description": "category_description"
}
```

**Note:** Returns an empty object `{}` if no category is found.

**Curl Example:**
```bash
curl -X GET "https://backend.aidimsum.com/v2/corpus_category?name=zyzd"
```

---

### 8. Text Search (V2)
**GET** `/v2/text_search`

Performs text search with support for both traditional and simplified Chinese characters. This is an alias for `/text_search_v2`.

**Parameters:**
- `keyword` (required): The search keyword
- `table_name` (required): The table to search in
- `limit` (optional): Maximum number of results to return

**Response:**
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

**Curl Example:**
```bash
curl -X GET "https://backend.aidimsum.com/v2/text_search?keyword=%E7%82%BA&table_name=%22cantonese_corpus_all%22&limit=10"
```

---

### 9. Get Corpus Item (V2)
**GET** `/v2/corpus_item`

Retrieves a specific corpus item by unique_id or data. Returns a single object instead of an array.

**Parameters:**
- `unique_id` (optional): The unique identifier of the corpus item
- `data` (optional): The data field of the corpus item

**Note:** Either `unique_id` or `data` parameter is required.

**Response:**
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

**Note:** Returns an empty object `{}` if no corpus item is found.

**Curl Examples:**
```bash
# Search by unique_id
curl -X GET "https://backend.aidimsum.com/v2/corpus_item?unique_id=your-uuid-here"

# Search by data
curl -X GET "https://backend.aidimsum.com/v2/corpus_item?data=%E7%82%BA"
```

---

### 10. Get Random Corpus Item
**GET** `/random_item`

Retrieves a random corpus item from a specified corpus.

**Parameters:**
- `corpus_name` (required): The name of the corpus to get a random item from (e.g., "zyzdv2", "yyjq")

**Response:**
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

**Curl Example:**
```bash
curl -X GET "https://backend.aidimsum.com/random_item?corpus_name=zyzdv2"
```

### 11. Get All Corpus Items
**GET** `/all_items`

Retrieves all corpus items from a specified corpus.

**Parameters:**
- `corpus_name` (required): The name of the corpus to get a random item from (e.g., "yyjq")
- `cursor` (optional): Indicating that data after the cursor is retrieved.
- `limit` (optional): Maximum number of results to return
- `lifecycle_stage` (optional): Filter by lifecycle stage. Supports multiple values via repeated parameters or comma-separated lists.

**lifecycle_stage available values:**
- `draft`: Not yet entered any processing flow
- `normalized`: Automated normalization completed
- `cleaned`: Manual cleaning completed
- `active`: Entered routine rule checks

**Response:**
```json
[
  {
    "unique_id": "uuid",
    "data": "character",
    "note": {
      "meaning": ["definition1", "definition2"],
      "pinyin": ["pronunciation1", "pronunciation2"]
    },
    "category": "yyjq",
    "tags": ["lyric"]
  }
]
```

**Curl Example:**
```bash
curl -X GET "https://backend.aidimsum.com/all_items?corpus_name=yyjq&cursor=0&limit=2"
```

**Curl Example (Filter):**
```bash
curl -X GET "https://backend.aidimsum.com/all_items?corpus_name=yyjq&lifecycle_stage=normalized&lifecycle_stage=draft"
```

## Developer APIs (API Key Required)

### 12. Create Corpus Item (Developer)
**POST** `/dev/insert_corpus_item`

Submits a request to create a new corpus item. Requires an approved API key. The request will be pending approval.

**Request Body:**
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

**Response (Success):**
```json
{
  "message": "Update request submitted successfully",
  "history_id": 123,
  "status": "PENDING",
  "operation_type": "CREATE"
}
```

**Curl Example:**
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

### 13. Update Corpus Item (Developer)
**POST** `/dev/update_corpus_item`

Submits a request to update an existing corpus item. Requires an approved API key. The request will be pending approval.

**Request Body:**
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

**Response (Success):**
```json
{
  "message": "Update request submitted successfully",
  "unique_id": "example-uuid-here",
  "status": "PENDING"
}
```

**Curl Example:**
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

### 14. Get Update History
**POST** `/dev/get_update_history`

Retrieves the update history for a specific corpus item by unique_id. Requires an approved API key.

**Request Body:**
```json
{
  "unique_id": "example-unique-id-here",
  "api_key": "your-approved-api-key"
}
```

**Response (Success):**
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

**Curl Example:**
```bash
curl -X POST "https://backend.aidimsum.com/dev/get_update_history" \
  -H "Content-Type: application/json" \
  -d '{
    "unique_id": "example-unique-id-here",
    "api_key": "your-approved-api-key"
  }'
```

---

### 15. Approve Corpus Item (Admin API Key Required)
**POST** `/dev/approve_corpus_item`

Approves a pending corpus item update or creation. Requires an admin-level API key.

**Request Body:**
```json
{
  "unique_id": "example-unique-id-here",
  "api_key": "admin-api-key-here"
}
```

**Response (Success - CREATE):**
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

**Response (Success - UPDATE):**
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

**Response (Error - Not PENDING):**
```json
{
  "error": "Update history status is not PENDING",
  "current_status": "APPROVED"
}
```

**Curl Example:**
```bash
curl -X POST "https://backend.aidimsum.com/dev/approve_corpus_item" \
  -H "Content-Type: application/json" \
  -d '{
    "unique_id": "example-unique-id-here",
    "api_key": "admin-api-key-here"
  }' | jq
```

---

### 16. Get API Key Status
**POST** `/dev/get_api_key_status`

Retrieves the status and details of your API key.

**Request Body:**
```json
{
  "api_key": "your-api-key-here"
}
```

**Response (Success):**
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

**Curl Example:**
```bash
curl -X POST "https://backend.aidimsum.com/dev/get_api_key_status" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your-api-key-here"
  }'
```

---

### 17. Get Taggers by Corpus Name
**POST** `/dev/get_taggers_by_corpus_name`

Retrieves detailed information about taggers (users who work on) a specific corpus category. Requires an approved API key.

**Request Body:**
```json
{
  "name": "corpus-name-here",
  "api_key": "your-api-key-here"
}
```

**Response (Success):**
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

**Curl Example:**
```bash
curl -X POST "https://backend.aidimsum.com/dev/get_taggers_by_corpus_name" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "corpus-name-here",
    "api_key": "your-api-key-here"
  }' | jq
```

---

## Admin APIs (Password Required)

### 18. Insert Corpus Item (Admin)
**POST** `/admin/insert_corpus_item`

Directly inserts a new corpus item. Requires admin password.

**Request Body:**
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

**Response (Success):**
```json
{
  "data": null,
  "error": null,
  "count": 1,
  "status": 201,
  "statusText": "Created"
}
```

**Response (Error - Unauthorized):**
```json
{
  "error": "Unauthorized: Invalid password"
}
```

**Curl Example:**
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

### 19. Update Corpus Item (Admin)
**POST** `/admin/update_corpus_item`

Directly updates an existing corpus item. Requires admin password.

**Request Body:**
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

**Response (Success):**
Status 204 (No Content) indicates successful update.

**Curl Example:**
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

### 20. Get User (Admin)
**POST** `/admin/get_user`

Retrieves user information by user ID or email. Includes associated account information. Requires admin password.

**Request Body:**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "password": "your-admin-password"
}
```

**Note:** Either `id` or `email` parameter is required.

**Response (Success):**
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

**Response (Error - User Not Found):**
```json
{
  "error": "User not found"
}
```

**Curl Example:**
```bash
curl -X POST "https://backend.aidimsum.com/admin/get_user" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "example_id",
    "email": "example_email",
    "password": "your-admin-password"
  }'
```

### 21. Get OSS Upload Policy (Admin)
**POST** `/admin/oss/upload-policy`

Generates a presigned upload policy for direct client-side upload to Aliyun OSS. Requires admin password.

**Request Body:**
```json
{
  "password": "your-admin-password",
  "bucket": "your-bucket-name",
  "dir": "upload/path/",
  "expireSeconds": 3600
}
```

**Parameters:**
- `password` (required): Admin password
- `bucket` (required): OSS bucket name
- `dir` (required): Directory path in the bucket (should end with `/`)
- `expireSeconds` (optional): Policy expiration time in seconds (default: 3600)

**Response (Success):**
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

**Curl Example:**
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

### 22. Upload File to OSS (Admin)
**POST** `/admin/oss/upload`

Directly uploads a file to Aliyun OSS through the server. Requires admin password. Uses multipart/form-data.

**Request Body (FormData):**
- `password` (required): Admin password
- `bucket` (required): OSS bucket name
- `dir` (required): Directory path in the bucket (should end with `/`)
- `file` (required): File to upload

**Response (Success):**
```json
{
  "success": true,
  "url": "https://dimsum-audio.oss-cn-guangzhou.aliyuncs.com/test/example.wav",
  "key": "test/example.wav"
}
```

**Response (Error):**
```json
{
  "error": "Failed to upload to OSS",
  "details": "error message from OSS"
}
```

**Curl Example:**
```bash
curl -X POST "https://backend.aidimsum.com/admin/oss/upload" \
  -F "password=your-admin-password" \
  -F "bucket=dimsum-audio" \
  -F "dir=xiaozhupeiqi/xcpq/" \
  -F "file=@./test.wav"
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Bad request message"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized: Invalid password"
}
```

### 403 Forbidden
```json
{
  "error": "API key not approved"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Data Structures

### Corpus Item Structure
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

### ZYZD Item Structure
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

## Authentication

### API Key Authentication
For developer APIs, include your API key in the request body:
```json
{
  "api_key": "your-approved-api-key"
}
```

### Admin Password Authentication
For admin APIs, include the admin password in the request body:
```json
{
  "password": "your-admin-password"
}
```

---

## Rate Limiting

Currently, there are no explicit rate limits implemented, but please use the API responsibly.

---

## Support

For API support or questions, please contact the development team.

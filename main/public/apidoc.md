# AI Dimsum API Documentation

Base URL: `https://dim-sum-prod.deno.dev`

## Table of Contents
- [Public APIs](#public-apis)
- [Developer APIs (API Key Required)](#developer-apis-api-key-required)
- [Admin APIs (Password Required)](#admin-apis-password-required)

## GET API KEY!

微信：19765681，目前阶段联系我获得 API KEY，未来会有更自动化的方式。

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
curl -X GET "https://dim-sum-prod.deno.dev/"
```

---

### 2. Get Corpus Apps
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
curl -X GET "https://dim-sum-prod.deno.dev/corpus_apps"
```

---

### 3. Get Corpus Categories
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
curl -X GET "https://dim-sum-prod.deno.dev/corpus_categories"
```

---

### 4. Get Specific Corpus Category
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
curl -X GET "https://dim-sum-prod.deno.dev/corpus_category?name=zyzd"
```

---

### 5. Text Search (Enhanced)
**GET** `/text_search_v2`

Performs text search with support for both traditional and simplified Chinese characters.

**Parameters:**
- `keyword` (required): The search keyword
- `table_name` (required): The table to search in (currently supports "cantonese_corpus_all")
- `limit` (optional): Maximum number of results to return
- `supabase_url` (optional): Custom Supabase URL

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
curl -X GET "https://dim-sum-prod.deno.dev/text_search_v2?keyword=為&table_name=cantonese_corpus_all&limit=10"
```

---

### 6. Get Corpus Item
**GET** `/corpus_item`

Retrieves a specific corpus item by unique_id or data.

**Parameters:**
- `unique_id` (optional): The unique identifier of the corpus item
- `data` (optional): The data field of the corpus item

**Note:** Either `unique_id` or `data` parameter is required.

**Response:**
```json
[
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
]
```

**Curl Examples:**
```bash
# Search by unique_id
curl -X GET "https://dim-sum-prod.deno.dev/corpus_item?unique_id=your-uuid-here"

# Search by data
curl -X GET "https://dim-sum-prod.deno.dev/corpus_item?data=為"
```

---

## Developer APIs (API Key Required)

### 7. Submit Corpus Item Update
**POST** `/dev/insert_corpus_item`

Submits an update request for a corpus item. Requires an approved API key.

**Request Body:**
```json
{
  "uuid": "corpus-item-uuid",
  "note": {
    "meaning": ["updated definition"],
    "pinyin": ["updated pronunciation"],
    "contributor": "user_id"
  },
  "api_key": "your-approved-api-key"
}
```

**Response (Success):**
```json
{
  "message": "Update request submitted successfully",
  "history_id": 123,
  "status": "PENDING"
}
```

**Response (Error - Invalid API Key):**
```json
{
  "error": "Invalid API key"
}
```

**Response (Error - API Key Not Approved):**
```json
{
  "error": "API key not approved"
}
```

**Response (Error - Corpus Item Not Found):**
```json
{
  "error": "Corpus item not found"
}
```

**Curl Example:**
```bash
curl -X POST "https://dim-sum-prod.deno.dev/dev/insert_corpus_item" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "your-corpus-item-uuid",
    "note": {
      "meaning": ["Updated definition"],
      "pinyin": ["updated_pronunciation"],
      "contributor": "user123"
    },
    "api_key": "your-approved-api-key"
  }'
```

---

## Admin APIs (Password Required)

### 8. Insert Corpus Item (Admin)
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
curl -X POST "https://dim-sum-prod.deno.dev/admin/insert_corpus_item" \
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

### ZYZD Item Structure (Input)
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
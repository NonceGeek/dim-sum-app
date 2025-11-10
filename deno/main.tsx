/* 
the api for ai dimsum devs.
*/
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { Application, Router } from "oak";
import { oakCors } from "cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tify, sify } from '@aqzhyi/chinese-conv'

console.log("Hello from AI Dimsum Devs API!");

// Admin password verification function
async function verifyAdminPassword(context: any, password: string): Promise<boolean> {
  const adminPwd = Deno.env.get("ADMIN_PWD");
  if (!password || password !== adminPwd) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized: Invalid password" };
    return false;
  }
  return true;
}

// API key verification function
async function verifyAPIKey(context: any, api_key: string): Promise<any> {
  // Convert api key format from "0x..." to "\\x..." to adapt with the bytea format in supabase
  let formattedApiKey = api_key;
  if (api_key && api_key.startsWith("0x")) {
    formattedApiKey = "\\x" + api_key.slice(2);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Get user_id and status by api key in table api_key
  const { data: apiKeyData, error: apiKeyError } = await supabase
    .from("api_key")
    .select("*")
    .eq("key", formattedApiKey)
    .single();

  if (apiKeyError || !apiKeyData) {
    context.response.status = 401;
    context.response.body = { error: "Invalid API key" };
    return null;
  }

  // If status != "APPROVED", return error
  if (apiKeyData.status !== "APPROVED") {
    context.response.status = 403;
    context.response.body = { error: "API key not approved" };
    return null;
  }

  // todo: the called_times field in table api_key should be incremented by 1.
  const { data: updateData, error: updateError } = await supabase
    .from("api_key")
    .update({ called_times: apiKeyData.called_times + 1 })
    .eq("id", apiKeyData.id);
  if (updateError) {
    console.error("Error updating called_times:", updateError);
    return null;
  }

  return apiKeyData;
}

// Supabase insert function
async function insertCorpusItem(
  data: string, 
  note: Record<string, unknown>, 
  category: string, 
  tags: string[]
) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const result = await supabase
    .from("cantonese_corpus_all")
    .insert({ data, note, category, tags });

  return result;
}

async function updateCorpusItem(
  unique_id: string,
  note: Record<string, unknown>,
  category: string,
  tags: string[]
) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  const result = await supabase
    .from("cantonese_corpus_all")
    .update({ note, category, tags })
    .eq("unique_id", unique_id);

  return result;
}

const router = new Router();

router
.get("/", async (context) => {
  context.response.body = { result: "Hello, Devs for AI Dimsum!" };
})
//exp: https://backend.aidimsum.com/all_items?corpus_name=yyjq&cursor=0&limit=2
.get("/all_items", async (context) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  const queryParams = context.request.url.searchParams;
  const corpus_name = queryParams.get("corpus_name");
  const limit = queryParams.get("limit") || "100";
  const cursor = queryParams.get("cursor");

  // Validate corpus_name parameter
  if (!corpus_name) {
    context.response.status = 400;
    context.response.body = { error: "corpus_name parameter is required" };
    return;
  }

  // Convert limit to number and validate
  const limitNum = parseInt(limit as string, 10);
  if (isNaN(limitNum) || limitNum <= 0 || limitNum > 1000) {
    context.response.status = 400;
    context.response.body = { error: "limit must be a positive number between 1 and 1000" };
    return;
  }

  try {
    // Build the query with pagination
    let query = supabase
      .from("cantonese_corpus_all")
      .select("*")
      .eq("category", corpus_name)
      .order("id", { ascending: true })
      .limit(limitNum);

    // Add cursor-based pagination if cursor is provided
    if (cursor) {
      const cursorNum = parseInt(cursor, 10);
      if (isNaN(cursorNum)) {
        context.response.status = 400;
        context.response.body = { error: "cursor must be a valid number" };
        return;
      }
      query = query.gt("id", cursorNum);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("Database error:", error);
      context.response.status = 500;
      context.response.body = { error: "Database query failed" };
      return;
    }

    // Calculate next cursor for pagination
    let nextCursor = null;
    if (data && data.length === limitNum && data.length > 0) {
      // If we got exactly the limit, there might be more data
      nextCursor = data[data.length - 1].id;
    }

    context.response.body = {
      data,
      pagination: {
        limit: limitNum,
        cursor: cursor || null,
        nextCursor,
        hasMore: data && data.length === limitNum
      }
    };
  } catch (err) {
    console.error("Unexpected error:", err);
    context.response.status = 500;
    context.response.body = { error: "Internal server error" };
  }
})
// exp: https://backend.aidimsum.com/random_item?corpus_name=zyzdv2
.get("/random_item", async (context) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  const queryParams = context.request.url.searchParams;
  const corpus_name = queryParams.get("corpus_name");
  
  // Validate corpus_name parameter
  if (!corpus_name) {
    context.response.status = 400;
    context.response.body = { error: "corpus_name parameter is required" };
    return;
  }

  // Construct the table name corpus_<corpus_name>
  const tableName = `corpus_${corpus_name}`;
  
  try {
    // First, get the total count of items in the table
    const { count, error: countError } = await supabase
      .from(tableName)
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("Error getting count:", countError);
      context.response.status = 500;
      context.response.body = { error: `Failed to access table ${tableName}` };
      return;
    }

    if (!count || count === 0) {
      context.response.status = 404;
      context.response.body = { error: `No items found in table ${tableName}` };
      return;
    }

    // Loop until we find a corpus item with valid meaning
    let corpusItem = null;
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loops

    while (!corpusItem && attempts < maxAttempts) {
      attempts++;
      
      // Generate a random offset
      const randomOffset = Math.floor(Math.random() * count);

      // Get a random item using the random offset
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .range(randomOffset, randomOffset)
        .single();

      if (error || !data) {
        console.error("Error fetching random item:", error);
        continue; // Try again
      }

      const unique_id = data.unique_id.toString();

      console.log("unique_id", unique_id);

      const { data: fetchedCorpusItem, error: corpusError } = await supabase
        .from("cantonese_corpus_all")
        .select("*")
        .eq("unique_id", unique_id)
        .single();

      console.log("fetchedCorpusItem", fetchedCorpusItem);
      
      if (corpusError || !fetchedCorpusItem) {
        console.error("Error fetching corpus item:", corpusError);
        continue; // Try again
      }

      if (corpus_name=="zyzdv2") {
        // Check if the meaning is valid (not null or [null])
        const meaning = fetchedCorpusItem.note?.context?.meaning;
        // console.log("meaning", meaning);
        if (meaning && Array.isArray(meaning) && meaning.length > 0 && meaning[0] !== null) {
          corpusItem = fetchedCorpusItem;
          break;
        }
      }else{
        corpusItem = fetchedCorpusItem;
        break;
      }
    }

    if (!corpusItem) {
      context.response.status = 404;
      context.response.body = { error: `No valid corpus items found in ${tableName} after ${maxAttempts} attempts` };
      return;
    }

    // Respond with the item
    context.response.status = 200;
    context.response.body = corpusItem;
  } catch (error) {
    console.error("Error in random_item endpoint:", error);
    context.response.status = 500;
    context.response.body = { error: "Internal server error" };
  }
})
// APIs for corpus things.
.get("/corpus_apps", async (context) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data, error } = await supabase
    .from("cantonese_corpus_apps")
    .select("*")

  if (error) {
    throw error;
  }

  context.response.body = data;
})
.get("/corpus_categories", async (context) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data, error } = await supabase
    .from("cantonese_categories")
    .select("*")

  if (error) {
    throw error;
  }

  context.response.body = data;
})
.get("/corpus_category", async (context) => {
  const queryParams = context.request.url.searchParams;
  const name = queryParams.get("name");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data, error } = await supabase
    .from("cantonese_categories")
    .select("*")
    .eq("name", name);

  if (error) {
    throw error;
  }

  context.response.body = data;
})
.get("/corpus_item", async (context) => {
  const queryParams = context.request.url.searchParams;
  const unique_id = queryParams.get("unique_id");
  const data = queryParams.get("data");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let query = supabase
    .from("cantonese_corpus_all")
    .select("*");

  if (unique_id) {
    query = query.eq("unique_id", unique_id);
  } else if (data) {
    query = query.eq("data", data);
  } else {
    context.response.status = 400;
    context.response.body = { error: "Either unique_id or data parameter is required" };
    return;
  }

  const { data: resp, error } = await query;

  if (error) {
    throw error;
  }

  context.response.body = resp;
})
.get("/text_search_v2", async (context) => { 
  const queryParams = context.request.url.searchParams;
  const key = queryParams.get("keyword");
  // Convert the key to both traditional and simplified Chinese
  const traditionalKey = tify(key ?? "");
  const simplifiedKey = sify(key ?? "");
  console.log("traditionalKey", traditionalKey);
  console.log("simplifiedKey", simplifiedKey);
  const tableName = queryParams.get("table_name") ?? "";
  // const column = queryParams.get("column");
  const limitStr = queryParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;
  const supabase_url = queryParams.get("supabase_url") || Deno.env.get("SUPABASE_URL") || "";
  // TODO: make SUPABASE_SERVICE_ROLE_KEY for a spec table as a param.
  const supabase = createClient(
    supabase_url,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  console.log("supabase_url", supabase_url);
  try {
    // const searchableTables = ["cantonese_corpus_all"];

    // Check if the table is allowed to be searched
    // if (!tableName || !searchableTables.includes(tableName)) {
    //   context.response.status = 403; // Forbidden status code
    //   context.response.body = {
    //     error: "The specified table is not searchable.",
    //   };
    //   return;
    // }
    // Search for both traditional and simplified versions
    const [traditionalResults, simplifiedResults] = await Promise.all([
      supabase
        .rpc('search_cantonese_corpus', { search_term: traditionalKey })
        .order("id", { ascending: false }),
      supabase
        .rpc('search_cantonese_corpus', { search_term: simplifiedKey })
        .order("id", { ascending: false })
    ]);

    // Merge and deduplicate results based on unique_id
    let mergedData = [...(traditionalResults.data || []), ...(simplifiedResults.data || [])];
    mergedData = Array.from(new Map(mergedData.map(item => [item.unique_id, item])).values());

    // Apply limit after merging if specified
    if (limit !== undefined && limit > 0) {
      mergedData = mergedData.slice(0, limit);
    }

    // TODO: handle mergedData, if the tableName == "cantonese_corpus_all", just return the mergedData, else filter the mergedData by tableName with column "category" == tableName
    if (tableName !== "cantonese_corpus_all") {
      mergedData = mergedData.filter((item: any) => item.category === tableName);
    }

    console.log("data", mergedData);
    context.response.status = 200;
    context.response.body = mergedData;
    
    if (traditionalResults.error || simplifiedResults.error) {
      throw traditionalResults.error || simplifiedResults.error;
    }
  } catch (error) { 
    console.error("Error fetching data:", error);
    context.response.status = 500;
    context.response.body = { error: "Failed to fetch data" };
  }
})
.get("/item/liked", async (context) => {
  const queryParams = context.request.url.searchParams;
  const item_id = queryParams.get("item_id");
  const user_id = queryParams.get("user_id");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  // TODO.
})

/* ↓↓↓ admin APIs ↓↓↓ */
/*
curl example:
curl -X POST http://localhost:8000/admin/insert_corpus_item \
  -H "Content-Type: application/json" \
  -d '{
    "data": "example corpus text data",
    "note": {
      "field1": "value1",
      "field2": "value2"
    },
    "category": "example_category",
    "tags": ["tag1", "tag2", "tag3"],
    "password": "your_admin_password_here"
  }'
*/
.post("/admin/insert_corpus_item", async (context) => {
  let body = await context.request.body();
  const content = await body.value;
  const { data, note, category, tags, password } = content;

  // Verify admin password
  if (!(await verifyAdminPassword(context, password))) {
    return { error: "Unauthorized: Invalid password" };
  }

  try {
    const result = await insertCorpusItem(data, note, category, tags);
    context.response.body = result;
  } catch (error) {
    context.response.status = 500;
    context.response.body = { error: "Failed to insert data" };
    console.error("Error inserting data:", error);
  }
})

// HINT: status 204 is normal, the meaning is updated success.
/*
curl example:
curl -X POST http://localhost:8000/admin/insert_corpus_item \
  -H "Content-Type: application/json" \
  -d '{
    "unique_id": "example_unique_id",
    "data": "example corpus text data",
    "note": {
      "field1": "value1",
      "field2": "value2"
    },
    "category": "example_category",
    "tags": ["tag1", "tag2", "tag3"],
    "password": "your_admin_password_here"
  }'
*/
.post("/admin/update_corpus_item", async (context) => {
  let body = await context.request.body();
  const content = await body.value;
  const { unique_id, note, category, tags, password } = content;
    // Verify admin password
    if (!(await verifyAdminPassword(context, password))) {
      return { error: "Unauthorized: Invalid password" };
    }
  
    try {
      const result = await updateCorpusItem(unique_id, note, category, tags);
      context.response.body = result;
    } catch (error) {
      context.response.status = 500;
      context.response.body = { error: "Failed to insert data" };
      console.error("Error inserting data:", error);
    }
})
/*
Curl example:
curl -X POST http://localhost:8000/admin/get_user \
  -H "Content-Type: application/json" \
  -d '{
    "id": "example_id",
    "email": "example_email",
    "password": "your_admin_password_here"
  }'
*/
.post("/admin/get_user", async (context) => {
  let body = await context.request.body();
  const content = await body.value;
  const { id, email, password } = content;
  console.log("id", id);
  console.log("email", email);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  // Verify admin password
  if (!(await verifyAdminPassword(context, password))) {
    return { error: "Unauthorized: Invalid password" };
  }
  try {
    // Select user based on id or email
    let query = supabase
      .from("User")
      .select("*");

    if (id) {
      query = query.eq("id", id);
    } else {
      query = query.eq("email", email);
    }

    const { data: userData, error: selectError } = await query.single();

    if (selectError || !userData) {
      console.error("Error selecting user:", selectError);
      context.response.status = 404;
      context.response.body = { error: "User not found" };
      return;
    }

    // Get Account items by userId and append to userData
    const { data: accountData, error: accountError } = await supabase
      .from("Account")
      .select("*")
      .eq("userId", userData.id);

    if (accountError) {
      console.error("Error fetching accounts:", accountError);
      // Don't fail the request, just log the error and return user without accounts
      context.response.status = 200;
      context.response.body = {
        ...userData,
        accounts: []
      };
      return;
    }

    // Return user data with accounts appended
    context.response.status = 200;
    context.response.body = {
      ...userData,
      accounts: accountData || []
    };
  } catch (error) {
    console.error("Error in get_user:", error);
    context.response.status = 500;
    context.response.body = { error: "Internal server error" };
  }
})
/* ↓↓↓ dev APIs(need api key) ↓↓↓ */
/*
HINT: DO NOT DELETE THE ANNOTATION BELOW.
TODO: 
1/ get user_id and status by api key in table api_key
2/ if status != "APPROVED", return error
3/ if status == "APPROVED", get the item from table cantonese_corpus_all by uuid

4/ insert an item into cantonese_corpus_update_history:
create table public.cantonese_corpus_update_history (
id bigint generated by default as identity not null,
unique_id uuid not null,
note jsonb not null,
status public.Status not null default 'PENDING'::"Status",
updated_at timestamp without time zone null default now(),
created_at timestamp with time zone not null default now(),
user_id text not null,
approver_user_id text null,
last_note jsonb not null,
constraint cantonese_corpus_update_history_pkey primary key (id)
) TABLESPACE pg_default;

last_note = item.note
*/
/*
Curl example:
curl -X POST http://localhost:8000/dev/insert_corpus_item \
  -H "Content-Type: application/json" \
  -d '{
    "data": "example corpus text data",
    "note": {
      "field1": "value1",
      "field2": "value2"
    },
    "category": "example_category",
    "tags": ["tag1", "tag2", "tag3"],
    "api_key": "api-key-here"
  }'
*/
.post("/dev/insert_corpus_item", async (context) => {
  // TODO.
  let body = await context.request.body();
  const content = await body.value;
  const { data, note, category, tags, api_key } = content;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  // Verify API key
  const apiKeyData = await verifyAPIKey(context, api_key);
  if (!apiKeyData) {
    return;
  }

  try {

    // 4. Insert an item into cantonese_corpus_update_history
    const { data: historyData, error: historyError } = await supabase
      .from("cantonese_corpus_update_history")
      .insert({
        tags: tags,
        category: category,
        data: data,
        note: note,
        status: "PENDING",
        user_id: apiKeyData.user_id,
        operation_type: "CREATE",
      })
      .select()
      .single();

    if (historyError) {
      context.response.status = 500;
      context.response.body = { error: "Failed to create update history record" };
      console.error("Error creating update history:", historyError);
      return;
    }

    context.response.status = 200;
    context.response.body = {
      message: "Update request submitted successfully",
      history_id: historyData.id,
      status: "PENDING",
      operation_type: "CREATE"
    };

  } catch (error) {
    console.error("Error in dev/insert_corpus_item:", error);
    context.response.status = 500;
    context.response.body = { error: "Internal server error" };
  }
})
/*
Curl example:
curl -X POST http://localhost:8000/dev/update_corpus_item \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "example-uuid-here",
    "note": {
      "field1": "value1",
      "field2": "value2"
    },
    "api_key": "api-key-here"
  }'
*/
.post("/dev/update_corpus_item", async (context) => {
  let body = await context.request.body();
  const content = await body.value;
  const { uuid, note, api_key } = content;
  
  // Verify API key
  const apiKeyData = await verifyAPIKey(context, api_key);
  if (!apiKeyData) {
    return;
  }
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Get the item from table cantonese_corpus_all by uuid
    const { data: corpusItem, error: corpusError } = await supabase
      .from("cantonese_corpus_all")
      .select("*")
      .eq("unique_id", uuid)
      .single();

    if (corpusError || !corpusItem) {
      context.response.status = 404;
      context.response.body = { error: "Corpus item not found" };
      return;
    }

    // 4. Insert an item into cantonese_corpus_update_history
    const { data: historyData, error: historyError } = await supabase
      .from("cantonese_corpus_update_history")
      .insert({
        unique_id: uuid,
        note: note,
        status: "PENDING",
        user_id: apiKeyData.user_id,
        last_note: corpusItem.note
      })
      .select()
      .single();

    if (historyError) {
      context.response.status = 500;
      context.response.body = { error: "Failed to create update history record" };
      console.error("Error creating update history:", historyError);
      return;
    }

    context.response.status = 200;
    context.response.body = {
      message: "Update request submitted successfully",
      history_id: historyData.id,
      status: "PENDING"
    };

  } catch (error) {
    console.error("Error in dev/update_corpus_item:", error);
    context.response.status = 500;
    context.response.body = { error: "Internal server error" };
  }
})
/* ↓↓↓ APIs for apps ↓↓↓ */
.get("/app/meme_pic_links", async (context) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  const { data, error } = await supabase
    .from("meme_pic_links")
    .select("*")

  if (error) {
    throw error;
  }

  context.response.body = data;
})
/*
curl example:
url -X POST http://localhost:8000/dev/get_api_key_status \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "api-key-here"
  }'
*/
.post("/dev/get_api_key_status", async (context) => {
  let body = await context.request.body();
  const content = await body.value;
  const { api_key } = content;
  const apiKeyData = await verifyAPIKey(context, api_key);
  context.response.body = apiKeyData;
})
/* ↓↓↓ sepc APIs ↓↓↓ */
// .get("/spec/insert_zyzd", async (context) => {
//   /*
//     read zyzd corpus from ../corpus/zyzd.json
//   */
//   interface ZyzdReading {
//     粵拼讀音: string;
//     讀音標記: string | null;
//     變調: string | null;
//   }

//   interface ZyzdEntry {
//     釋義: string;
//     讀音: ZyzdReading[];
//   }

//   interface ZyzdItem {
//     編號: string;
//     頁: number;
//     字頭: string[];
//     義項: ZyzdEntry[];
//     _校訂補充: {
//       異體: string[];
//       校訂註: string | null;
//     };
//   }
   /*
    HINT: DO NOT DELETE THE EXAMPLE BELOW.
    here is the item example: 
    - if 字頭 has multiple items, make multiple corpus items, 字頭 = data
    - note = {"meaning": ["釋義 1", "釋義 2"...], "pinyin": ["粵拼讀音_1", "粵拼讀音_2"...], contributor: "0x04"}
    - category = "zyzd"
    - tags = ["word"]
    {
        "編號": "0005",
        "頁": 1,
        "字頭": [
            "為",
            "爲"
        ],
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
            },
            {
                "釋義": "㈡①～社會服務。②表目的。③幫助。④對、向",
                "讀音": [
                    {
                        "粵拼讀音": "wai6",
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
    },
    */

//   interface ProcessingResult {
//     success: boolean;
//     character: string;
//     error?: string;
//   }

//   const zyzdCorpus = await Deno.readTextFile("../corpus/zyzd.json");
//   const zyzdCorpusArray = JSON.parse(zyzdCorpus) as ZyzdItem[];
//   const results: ProcessingResult[] = [];

//   for (const item of zyzdCorpusArray) {
//     console.log("Processing item:", item.編號);
//     console.log("item", item);

//     // For each character in 字頭, create a separate entry
//     for (const char of item.字頭) {
//       // Format the note object
//       const note = {
//         "context": {
//           meaning: item.義項.map((entry: ZyzdEntry) => entry.釋義),
//           pinyin: item.義項.flatMap((entry: ZyzdEntry) => 
//             entry.讀音.map((sound: ZyzdReading) => sound.粵拼讀音)
//           ),
//           page: item.頁,
//           number: item.編號,
//           others: item._校訂補充
//         },
//         contributor: "0x05",
//       };
//       console.log("note", note);

//       try {
//         // Insert the item into the database
//         const result = await insertCorpusItem(
//           char,  // data (the character)
//           note,  // note (stringified object)
//           "zyzdv2",  // category
//           ["word"]  // tags
//         );
//         console.log("result", result);
//         results.push({ success: true, character: char });
//       } catch (error) {
//         console.error(`Error inserting character ${char}:`, error);
//         results.push({ success: false, character: char, error: error instanceof Error ? error.message : String(error) });
//       }
//     }
//   }
  
//   context.response.body = {
//     message: "ZYZD corpus processing completed",
//     results
//   };
// })

const app = new Application();

app.use(oakCors()); // Enable CORS for All Routes
app.use(router.routes());

console.info("CORS-enabled web server listening on port 8000");
await app.listen({ port: 8000 });

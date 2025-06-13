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

const router = new Router();

router
.get("/", async (context) => {
  context.response.body = { result: "Hello, Devs for AI Dimsum!" };
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
.get("/text_search_v2", async (context) => { 
  const queryParams = context.request.url.searchParams;
  const key = queryParams.get("keyword");
  // Convert the key to both traditional and simplified Chinese
  const traditionalKey = tify(key);
  const simplifiedKey = sify(key);
  console.log("traditionalKey", traditionalKey);
  console.log("simplifiedKey", simplifiedKey);
  const tableName = queryParams.get("table_name");
  // const column = queryParams.get("column");
  const limit = parseInt(queryParams.get("limit"), 10); // Get limit from query and convert to integer
  const supabase_url = queryParams.get("supabase_url") || Deno.env.get("SUPABASE_URL");
  // TODO: make SUPABASE_SERVICE_ROLE_KEY for a spec table as a param.
  const supabase = createClient(
    supabase_url,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  console.log("supabase_url", supabase_url);
  try {
    // TODO: make searchableTables dynamic.
    const searchableTables = ["cantonese_corpus_all"];

    // Check if the table is allowed to be searched
    if (!searchableTables.includes(tableName)) {
      context.response.status = 403; // Forbidden status code
      context.response.body = {
        error: "The specified table is not searchable.",
      };
      return;
    }
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
    if (!isNaN(limit) && limit > 0) {
      mergedData = mergedData.slice(0, limit);
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
.post("/dev/insert_corpus_item", async (context) => {
  let body = await context.request.body();
  const content = await body.value;
  console.log("body", content);
  const { uuid, note, api_key } = content;
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // 1. Get user_id and status by api key in table api_key
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from("api_key")
      .select("*")
      .eq("key", api_key)
      .single();

    if (apiKeyError || !apiKeyData) {
      context.response.status = 401;
      context.response.body = { error: "Invalid API key" };
      return;
    }

    // 2. If status != "APPROVED", return error
    if (apiKeyData.status !== "APPROVED") {
      context.response.status = 403;
      context.response.body = { error: "API key not approved" };
      return;
    }

    // 3. Get the item from table cantonese_corpus_all by uuid
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
    console.error("Error in dev/insert_corpus_item:", error);
    context.response.status = 500;
    context.response.body = { error: "Internal server error" };
  }
})
/* ↓↓↓ admin APIs ↓↓↓ */
.post("/admin/insert_corpus_item", async (context) => {
  let body = await context.request.body();
  const content = await body.value;
  console.log("body", content);
  const { data, note, category, tags, password } = content;

  // Verify admin password
  if (!(await verifyAdminPassword(context, password))) {
    return;
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
/* ↓↓↓ sepc APIs ↓↓↓ */
.get("/insert_zyzd", async (context) => {
  /*
    read zyzd corpus from ../corpus/zyzd.json
  */
  const zyzdCorpus = await Deno.readTextFile("../corpus/zyzd.json");
  const zyzdCorpusArray = JSON.parse(zyzdCorpus);
  const results = [];

  for (const item of zyzdCorpusArray) {
    console.log("Processing item:", item.編號);
    console.log("item", item);
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
    // For each character in 字頭, create a separate entry
    for (const char of item.字頭) {
      // Format the note object
      const note = {
        meaning: item.義項.map(entry => entry.釋義),
        pinyin: item.義項.flatMap(entry => 
          entry.讀音.map(sound => sound.粵拼讀音)
        ),
        contributor: "0x04",
        page: item.頁,
        number: item.編號,
        others: item._校訂補充
      };
      console.log("note", note);

      try {
        // Insert the item into the database
        const result = await insertCorpusItem(
          char,  // data (the character)
          note,  // note (stringified object)
          "zyzd",  // category
          ["word"]  // tags
        );
        console.log("result", result);
      } catch (error) {
        console.error(`Error inserting character ${char}:`, error);
      }
    }
  }
  
  context.response.body = {
    message: "ZYZD corpus processing completed",
    results
  };
})

const app = new Application();

app.use(oakCors()); // Enable CORS for All Routes
app.use(router.routes());

console.info("CORS-enabled web server listening on port 8000");
await app.listen({ port: 8000 });

/*
1. get all the corpus items from the database by the API /all_items with corpus_name = yydh.
2. for each corpus item, check if tags include "大圣归来",
3. if no, do nothing.
4. if yes, update the category of item to "dsgl".
*/
import https from 'node:https';

const ADMIN_PWD = process.env.ADMIN_PWD;
if (!ADMIN_PWD) {
  console.error('Error: ADMIN_PWD environment variable is not set');
  console.error('Please set it with: export ADMIN_PWD=your_password');
  process.exit(1);
}

const SOURCE_CATEGORY = process.env.SOURCE_CATEGORY || 'yydh';
const TARGET_CATEGORY = process.env.TARGET_CATEGORY || 'nz';
const TAG_FILTER = process.env.TAG_FILTER || '哪吒';
const PAGE_LIMIT = 400;

function httpsGet(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'backend.aidimsum.com',
      port: 443,
      path: urlPath,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`Failed to parse response: ${body}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(urlPath, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'backend.aidimsum.com',
      port: 443,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, data: body });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Fetch all items from a corpus using cursor-based pagination
async function fetchAllItems(corpusName) {
  const allItems = [];
  let cursor = 0;

  while (true) {
    const encodedName = encodeURIComponent(corpusName);
    const res = await httpsGet(
      `/all_items?corpus_name=${encodedName}&cursor=${cursor}&limit=${PAGE_LIMIT}`
    );

    const items = res.data;
    const pagination = res.pagination;

    if (!Array.isArray(items) || items.length === 0) break;

    allItems.push(...items);
    console.log(`  Fetched ${items.length} items (total so far: ${allItems.length})`);

    if (!pagination?.hasMore) break;
    cursor = pagination.nextCursor;
  }

  return allItems;
}

async function updateCategory(uniqueId, category) {
  return httpsPost('/admin/update_corpus_item', {
    unique_id: uniqueId,
    category,
    password: ADMIN_PWD
  });
}

async function main() {
  console.log(`Fetching all items from corpus "${SOURCE_CATEGORY}"...`);
  const items = await fetchAllItems(SOURCE_CATEGORY);
  console.log("all items", items);
  console.log(`Total items fetched: ${items.length}`);

  const matched = items.filter(item =>
    Array.isArray(item.tags) && item.tags.includes(TAG_FILTER)
  );
  console.log(`Items with tag "${TAG_FILTER}": ${matched.length}`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < matched.length; i++) {
    const item = matched[i];
    console.log(`\n[${i + 1}/${matched.length}] ${item.data} (${item.unique_id})`);

    try {
      const result = await updateCategory(item.unique_id, TARGET_CATEGORY);
      console.log(`  ✅ Category changed to "${TARGET_CATEGORY}" (status: ${result.statusCode})`);
      successCount++;
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors:  ${errorCount}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

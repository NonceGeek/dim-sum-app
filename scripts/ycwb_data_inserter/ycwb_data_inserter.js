// 1. get the data from "../../corpus/ycwb_image_record_example.csv"
// 2. re organize the data
// 3. insert the data into the database
// ! DO NOT DELETE: remember to use csv parser to parse the csv file.
import { parse } from '@vanillaes/csv'
import fs from 'node:fs';   
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read admin password from environment
const ADMIN_PWD = process.env.ADMIN_PWD;
if (!ADMIN_PWD) {
  console.error('Error: ADMIN_PWD environment variable is not set');
  console.error('Please set it with: export ADMIN_PWD=your_password');
  process.exit(1);
}

// Function to insert data via API
async function insertCorpusItem(data, note, category, tags) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      data: data,
      note: note,
      category: category,
      tags: tags,
      password: ADMIN_PWD
    });

    const options = {
      hostname: 'backend.aidimsum.com',
      port: 443,
      path: '/admin/insert_corpus_item',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            statusCode: res.statusCode,
            data: responseData
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

const csvPath = path.join(__dirname, "../../corpus/ycwb_image_record_example.csv");
const csv = fs.readFileSync(csvPath, "utf-8");
let parsed = parse(csv)
// console.log(parsed);

// delete the first row
let header = parsed.shift();
console.log(header);
console.log("---------- header --------------");

// [
//     '#',           'id',
//     'doc_cat',     'doc_content',
//     'doc_author',  'doc_createtime',
//     'photo_width', 'photo_height',
//     'photo_time',  'doc_ai_tag',
//     'sys_authors', 'sys_topic',
//     'photo_type',  'photo_name',
//     'vllm_type',   'vllm_summary'
//   ]
// Main async function to process data
async function processData() {
  console.log(`Starting to process ${parsed.length} rows...`);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    console.log(`\n--- Processing row ${i + 1}/${parsed.length} ---`);
    // [
    //     '1',
    //     '330',
    //     '图片制作图片库',
    //     '',
    //     '图片制作员1',
    //     '2022/6/23 16:38',
    //     '864',
    //     '1919',
    //     '2021/1/12 17:05',
    //     '传统建筑,现代建筑,地下通道',
    //     '图片制作员1',
    //     '296179_yylyzn_1610812800000@@15627@@ k',
    //     '',
    //     '2e9cdce2c6a8e6eb1e48b74b841df87b.JPG',
    //     '岭南传统建筑 文魁阁,古建筑,岭南历史事件',
    //     '图片展示了一座传统的岭南建筑，门楣上方悬挂着一块写着“文魁阁”的牌匾，字体古朴典雅。门洞上方还有一块较小的牌匾，写着“吉祥如意”。门洞两侧有对联，内容为“一帆风顺年年好”。建筑的墙面装饰有精美的几何图案，屋顶为典型的岭南风格，瓦片整齐排列，屋檐翘起。整体氛围古朴，透露出浓厚的历史文化气息。'
    //   ]
    let data = row[15];
    let note = {context: {}, contributor: "0x0A"};
    // to make the note with data as json: id, doc_cat, doc_content, doc_author, doc_createtime, photo_time, doc_ai_tag, photo_name, vllm_type, vllm_summary
    note.context.id = row[1];
    note.context.doc_cat = row[2];
    note.context.doc_content = row[3];
    note.context.doc_author = row[4];
    // note.doc_createtime = row[5];
    note.context.photo_time = row[8];
    note.context.doc_ai_tag = row[9];
    note.context.photo_url = "https://ycwb-data-collection.oss-cn-guangzhou.aliyuncs.com/" + row[13];
    note.context.vllm_type = row[14];
    note.context.vllm_summary = row[15];

    const tags = ["news", ...note.context.doc_ai_tag.split(",")];
    console.log(tags);
    console.log("---------- tags --------------");
    console.log(data);
    console.log("---------- data --------------");
    console.log(note);
    console.log("-------------note---------------");

    try {
      // Map to API format - use vllm_summary as data and vllm_type for category
      const category = "ycwb_photo_collection"; // Fixed category for YCWB images
      
      console.log(`Inserting: ID=${note.context.id}, Photo=${note.context.photo_url}`);
      
      const result = await insertCorpusItem(data, note, category, tags);
      console.log(`✅ Success! Status: ${result.statusCode}`);
      successCount++;
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error inserting row ${i + 1}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n=== Processing Complete ===`);
  console.log(`✅ Successful insertions: ${successCount}`);
  console.log(`❌ Failed insertions: ${errorCount}`);
  console.log(`📊 Total processed: ${parsed.length}`);
}

// Run the main function
processData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
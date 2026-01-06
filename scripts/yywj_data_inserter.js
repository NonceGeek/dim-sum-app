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

const csvPath = path.join(__dirname, "../corpus/yywj.csv");
const csv = fs.readFileSync(csvPath, "utf-8");
let parsed = parse(csv)
// console.log(parsed);

// delete(ignore) the first row
let header = parsed.shift();
console.log(header);
console.log("---------- header --------------");

async function processData() {
  console.log(`Starting to process ${parsed.length} rows...`);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    console.log(`\n--- Processing row ${i}/${parsed.length} ---`);
    // 序号,粤语原文,普通话翻译,粤语拼音,场景
    // 1,你好！,你好！,nei5 hou2！,1问候场景
    let note = {context: {}, contributor: "0x08"};
    let data = row[1]; // 粤语原文 - Cantonese original text
    // to make the note with data as json: 序号, 粤语原文, 普通话翻译, 粤语拼音, 场景
    note.context.粤语原文 = row[1];
    note.context.普通话翻译 = row[2];
    note.context.粤语拼音 = row[3];
    note.context.场景 = row[4];
    // Generate audio link based on 序号 and data
    const padded序号 = String(row[0]).padStart(5, '0'); // Pad 序号 to 5 digits
    const encodedData = encodeURIComponent(data); // URL-encode the 粤语原文
    note.context.audio = `https://dimsum-audio.oss-cn-guangzhou.aliyuncs.com/yywj/${padded序号}${encodedData}.wav`;

    const tags = [note.context.场景];
    console.log(tags);
    console.log("---------- tags --------------");
    console.log(data);
    console.log("---------- data --------------");
    console.log(note);
    console.log("-------------note---------------");

    try {
      // Map to API format - use 粤语原文 as data
      const category = "yywj"; // Category for YYWJ corpus
      
      console.log(`Inserting: 序号=${note.context.序号}, 粤语原文=${data}`);
      
      const result = await insertCorpusItem(data, note, category, tags);
      console.log(`✅ Success! Status: ${result.statusCode}`);
      successCount++;
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error inserting row ${i}:`, error.message);
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
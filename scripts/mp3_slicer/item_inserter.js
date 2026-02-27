// 1. get wav files from wlxfbdl folder
// 2. re organize the data
// 3. insert the data into the database
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

// Get all wav files from wlxfbdl folder
const wlxfbdlDir = path.join(__dirname, "segments/gfxm2");
const wavFiles = fs.readdirSync(wlxfbdlDir).filter(f => f.endsWith('.wav'));
console.log(`Found ${wavFiles.length} wav files in gfxm2 folder`);
console.log("---------- wav files --------------");

// Main async function to process data
async function processData() {
  console.log(`Starting to process ${wavFiles.length} wav files...`);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < wavFiles.length; i++) {
    const fileName = wavFiles[i];
    const fileNameWithoutExt = fileName.replace(/\.wav$/, '');
    console.log(`\n--- Processing file ${i + 1}/${wavFiles.length} ---`);

    let data = fileNameWithoutExt;
    let note = {context: {}, contributor: "0x19"};
    note.context.audio = `https://dimsum-audio.oss-cn-guangzhou.aliyuncs.com/gfxm2/${fileName}`;
    note.context.粤语文本 = fileNameWithoutExt;

    const tags = ["音频", "动画", "功夫熊猫2"];
    console.log(tags);
    console.log("---------- tags --------------");
    console.log(data);
    console.log("---------- data --------------");
    console.log(note);
    console.log("-------------note---------------");

    try {
      const category = "yydh";
      
      console.log(`Inserting: File=${fileName}, Audio=${note.context.audio}`);
      
      const result = await insertCorpusItem(data, note, category, tags);
      console.log(`✅ Success! Status: ${result.statusCode}`);
      console.log("result", result);
      successCount++;
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error inserting file ${i + 1}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n=== Processing Complete ===`);
  console.log(`✅ Successful insertions: ${successCount}`);
  console.log(`❌ Failed insertions: ${errorCount}`);
  console.log(`📊 Total processed: ${wavFiles.length}`);
}

// Run the main function
processData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

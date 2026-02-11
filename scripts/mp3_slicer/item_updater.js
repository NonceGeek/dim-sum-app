/* 
TODO: impl the item updater based on the item_inserter.js.
1. loop all the .srt files in a folder.
2. for each .srt file, read the file and get the text.
3. get text, and call the API to get the corpus item by /v2/corpus_item, the data = text.
4. if the item is not found, skip this text.
5. if the item is found, update the item in the database with the new tags by the API /admin/update_corpus_item.
*/
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

// Read tags from environment (comma-separated) or use default
const TAGS_TO_ADD = process.env.TAGS_TO_ADD?.split(',').map(t => t.trim()) || [];
if (TAGS_TO_ADD.length === 0) {
  console.error('Error: TAGS_TO_ADD environment variable is not set');
  console.error('Please set it with: export TAGS_TO_ADD=tag1,tag2,tag3');
  process.exit(1);
}

// Read SRT folder from environment or use default
const SRT_FOLDER = process.env.SRT_FOLDER || path.join(__dirname, 'segments/srt');

// Function to get corpus item by data
async function getCorpusItem(data) {
  return new Promise((resolve, reject) => {
    const encodedData = encodeURIComponent(data);
    const options = {
      hostname: 'backend.aidimsum.com',
      port: 443,
      path: `/v2/corpus_item?data=${encodedData}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${responseData}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Function to update corpus item tags
async function updateCorpusItemTags(uniqueId, tags) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      unique_id: uniqueId,
      tags: tags,
      password: ADMIN_PWD
    });

    const options = {
      hostname: 'backend.aidimsum.com',
      port: 443,
      path: '/admin/update_corpus_item',
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
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
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

// Function to parse SRT file and extract text entries
function parseSrtFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const texts = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Skip sequence number (just a number)
    if (/^\d+$/.test(line)) {
      i++;
      // Skip timestamp line (format: 00:00:00,000 --> 00:00:00,000)
      if (i < lines.length && lines[i].includes('-->')) {
        i++;
        // Collect text lines until empty line or next sequence number
        let textLines = [];
        while (i < lines.length && lines[i].trim() !== '' && !/^\d+$/.test(lines[i].trim())) {
          textLines.push(lines[i].trim());
          i++;
        }
        if (textLines.length > 0) {
          texts.push(textLines.join(' '));
        }
      }
    } else {
      i++;
    }
  }
  
  return texts;
}

// Merge tags (add new tags while keeping existing ones)
function mergeTags(existingTags, newTags) {
  const result = [...(existingTags || [])];
  newTags.forEach(tag => {
    if (!result.includes(tag)) {
      result.push(tag);
    }
  });
  return result;
}

// Main async function to process data
async function processData() {
  // Check if SRT folder exists
  if (!fs.existsSync(SRT_FOLDER)) {
    console.error(`Error: SRT folder does not exist: ${SRT_FOLDER}`);
    console.error('Please create the folder and add .srt files, or set SRT_FOLDER environment variable');
    process.exit(1);
  }

  // Get all srt files from folder
  const srtFiles = fs.readdirSync(SRT_FOLDER).filter(f => f.endsWith('.srt'));
  console.log(`Found ${srtFiles.length} srt files in ${SRT_FOLDER}`);
  console.log(`Tags to add: ${TAGS_TO_ADD.join(', ')}`);
  console.log("---------- Starting processing --------------");

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  let totalTexts = 0;

  for (let i = 0; i < srtFiles.length; i++) {
    const fileName = srtFiles[i];
    const filePath = path.join(SRT_FOLDER, fileName);
    console.log(`\n=== Processing file ${i + 1}/${srtFiles.length}: ${fileName} ===`);

    // Parse SRT file to get text entries
    const texts = parseSrtFile(filePath);
    console.log(`Found ${texts.length} text entries in ${fileName}`);
    totalTexts += texts.length;

    for (let j = 0; j < texts.length; j++) {
      const text = texts[j];
      console.log(`\n--- Processing text ${j + 1}/${texts.length} ---`);
      console.log(`Text: ${text}`);

      try {
        // Get corpus item by data
        const corpusItem = await getCorpusItem(text);
        
        // Check if item was found (empty object means not found)
        if (!corpusItem.unique_id) {
          console.log(`⏭️ Skipped: Item not found in database`);
          skipCount++;
          continue;
        }

        console.log(`Found item with unique_id: ${corpusItem.unique_id}`);
        console.log(`Existing tags: ${corpusItem.tags?.join(', ') || 'none'}`);

        // Merge existing tags with new tags
        const mergedTags = ["动画", "小猪佩奇2"]
        // const mergedTags = mergeTags(corpusItem.tags, TAGS_TO_ADD);
        console.log(`New tags: ${mergedTags.join(', ')}`);

        // Update corpus item with merged tags
        const result = await updateCorpusItemTags(corpusItem.unique_id, mergedTags);
        console.log(`✅ Success! Status: ${result.statusCode}`);
        successCount++;
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing text "${text}":`, error.message);
        errorCount++;
      }
    }
  }

  console.log(`\n=== Processing Complete ===`);
  console.log(`📄 Total SRT files processed: ${srtFiles.length}`);
  console.log(`📝 Total text entries: ${totalTexts}`);
  console.log(`✅ Successful updates: ${successCount}`);
  console.log(`⏭️ Skipped (not found): ${skipCount}`);
  console.log(`❌ Failed updates: ${errorCount}`);
}

// Run the main function
processData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

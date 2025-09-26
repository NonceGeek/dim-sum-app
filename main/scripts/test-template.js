const XLSX = require('xlsx');
const path = require('path');

// 测试模板解析
function testTemplate() {
  // 读取生成的模板文件
  const templatePath = path.join(__dirname, '../public/templates/data_annotation_template.xlsx');

  try {
    const workbook = XLSX.readFile(templatePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log('读取的数据：');
    jsonData.forEach((row, index) => {
      console.log(`第${index + 1}行:`, row);
    });

    // 测试解析函数
    const parseDelimitedString = (value) => {
      if (!value) return [];
      return value.toString().split('|').map(item => item.trim()).filter(item => item);
    };

    const parseNameLinkPairs = (value) => {
      if (!value) return [];
      return value.toString().split('|').map(item => {
        const parts = item.split('->').map(part => part.trim());
        return {
          name: parts[0] || "",
          link: parts[1] || ""
        };
      }).filter(item => item.name || item.link);
    };

    // 测试示例行（第二行）的解析
    if (jsonData.length > 1) {
      const testRow = jsonData[1];
      console.log('\n解析测试：');
      console.log('原始粤音:', testRow['粤音']);
      console.log('解析后粤音:', parseDelimitedString(testRow['粤音']));

      console.log('原始组词:', testRow['组词']);
      console.log('解析后组词:', parseDelimitedString(testRow['组词']));

      console.log('原始相关文献:', testRow['相关文献']);
      console.log('解析后相关文献:', parseNameLinkPairs(testRow['相关文献']));
    }

  } catch (error) {
    console.error('测试失败:', error);
  }
}

testTemplate();
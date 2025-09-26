const XLSX = require('xlsx');
const path = require('path');

// 创建符合数据模型规范的模板文件
function generateTemplate() {
  // 根据详情页面的数据结构创建模板
  const templateData = [
    // 表头
    {
      "字符": "字符",
      "分类": "分类",
      "粤音": "粤音",
      "组词": "组词",
      "句子": "句子",
      "相关文献": "相关文献",
      "视频切片": "视频切片"
    },
    // 示例数据行
    {
      "字符": "行",
      "分类": "zyzdv2",
      "粤音": "hang4|haang4|hong4",
      "组词": "㈠①走：步～．～路。②流通。③傳遞：發～。④能幹：他真～|㈡①排：一目十～。②職業：同～。③商店：車～．～市|㈢〈古〉行動：操～",
      "句子": "佢行得好快|今日做乜行？|呢行生意唔好做",
      "相关文献": "粤语词汇研究->https://example.com/doc1|广东话字典->https://example.com/doc2",
      "视频切片": "粤语教学视频1->https://example.com/video1|粤语教学视频2->https://example.com/video2"
    },
    // 空行作为模板
    {
      "字符": "",
      "分类": "zyzdv2",
      "粤音": "",
      "组词": "",
      "句子": "",
      "相关文献": "",
      "视频切片": ""
    }
  ];

  // 创建工作簿
  const wb = XLSX.utils.book_new();

  // 创建工作表
  const ws = XLSX.utils.json_to_sheet(templateData);

  // 设置列宽
  const colWidths = [
    { wch: 8 },  // 字符
    { wch: 15 }, // 分类
    { wch: 30 }, // 粤音 (多个用|分隔)
    { wch: 50 }, // 组词 (多个用|分隔)
    { wch: 50 }, // 句子 (多个用|分隔)
    { wch: 60 }, // 相关文献 (格式: 名称->链接|名称->链接)
    { wch: 60 }  // 视频切片 (格式: 名称->链接|名称->链接)
  ];
  ws['!cols'] = colWidths;

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(wb, ws, "数据标注模板");

  // 输出文件路径
  const outputPath = path.join(__dirname, '../public/templates/data_annotation_template.xlsx');

  // 写入文件
  XLSX.writeFile(wb, outputPath);

  console.log('模板文件已生成:', outputPath);
}

// 运行生成器
generateTemplate();
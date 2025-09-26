"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Eye, ExternalLink, Volume2, BookOpen, Video } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useBatchCreateCorpusItems } from "@/lib/hooks/useDataAnnotation";

interface BatchUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data: any[];
}

export function BatchUploadDialog({ open, onOpenChange, onSuccess }: BatchUploadDialogProps) {
  const batchCreateMutation = useBatchCreateCorpusItems();
  const [isValidating, setIsValidating] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [step, setStep] = useState<"upload" | "validate" | "preview" | "confirm">("upload");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationResult(null);
      setStep("upload");
    }
  };

  // 解析用|分隔的字符串
  const parseDelimitedString = (value: any): string[] => {
    if (!value) return [];
    return value.toString().split('|').map((item: string) => item.trim()).filter((item: string) => item);
  };

  // 解析相关文献和视频切片格式 (名称->链接)
  const parseNameLinkPairs = (value: any): { name: string; link: string }[] => {
    if (!value) return [];
    return value.toString().split('|').map((item: string) => {
      const parts = item.split('->').map(part => part.trim());
      return {
        name: parts[0] || "",
        link: parts[1] || ""
      };
    }).filter((item: { name: string; link: string }) => item.name || item.link);
  };

  const validateExcelData = async (file: File): Promise<ValidationResult> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const errors: string[] = [];
          const validData: any[] = [];

          jsonData.forEach((row: any, index: number) => {
            const rowNum = index + 2; // Excel行号从2开始（第1行是表头）

            // 跳过空行
            if (!row["字符"] && !row["粤音"] && !row["分类"]) {
              return;
            }

            // 检查必填字段：字符
            if (!row["字符"] || !row["字符"].toString().trim()) {
              errors.push(`第${rowNum}行：字符不能为空`);
              return;
            }

            // 检查必填字段：粤音
            if (!row["粤音"] || !row["粤音"].toString().trim()) {
              errors.push(`第${rowNum}行：粤音不能为空`);
              return;
            }

            // 处理数据格式
            const processedRow = {
              data: row["字符"].toString().trim(),
              category: (row["分类"] || "zyzdv2").toString().trim(),
              pinyin: parseDelimitedString(row["粤音"]),
              meaning: parseDelimitedString(row["组词"]),
              sentence: parseDelimitedString(row["句子"]),
              related_documents: parseNameLinkPairs(row["相关文献"]),
              video_clips: parseNameLinkPairs(row["视频切片"]),
            };

            // 验证粤音不为空
            if (processedRow.pinyin.length === 0) {
              errors.push(`第${rowNum}行：粤音格式错误或为空`);
              return;
            }

            validData.push(processedRow);
          });

          resolve({
            isValid: errors.length === 0,
            errors,
            data: validData,
          });
        } catch (error) {
          resolve({
            isValid: false,
            errors: ["文件格式错误，请确保使用正确的Excel模板"],
            data: [],
          });
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleValidate = async () => {
    if (!file) {
      toast.error("请先选择文件");
      return;
    }

    setIsValidating(true);
    try {
      const result = await validateExcelData(file);
      setValidationResult(result);
      setStep("validate");

      if (result.isValid) {
        toast.success(`验证成功！共 ${result.data.length} 条有效数据`);
        setStep("preview"); // 验证成功后进入预览步骤
      } else {
        toast.error(`验证失败！发现 ${result.errors.length} 个错误`);
        setStep("validate"); // 验证失败显示错误
      }
    } catch (error) {
      toast.error("文件验证失败");
      console.error(error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleUpload = () => {
    if (!validationResult || !validationResult.isValid) {
      toast.error("请先通过验证");
      return;
    }

    batchCreateMutation.mutate({
      data: validationResult.data,
    }, {
      onSuccess: () => {
        // 重置状态
        setFile(null);
        setValidationResult(null);
        setStep("upload");

        onOpenChange(false);
        onSuccess();
      }
    });
  };

  const handleCancel = () => {
    setFile(null);
    setValidationResult(null);
    setStep("upload");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${step === "preview" ? "max-w-7xl max-h-[90vh]" : "max-w-2xl max-h-[80vh]"} overflow-hidden flex flex-col`}>
        <DialogHeader>
          <DialogTitle>
            批量上传数据
            {step === "upload" && " - 选择文件"}
            {step === "validate" && " - 验证结果"}
            {step === "preview" && " - 数据预览"}
          </DialogTitle>
        </DialogHeader>

        {/* 进度指示器 */}
        <div className="flex items-center justify-between mb-6 px-4">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              step === "upload" ? "bg-purple-600 text-white" :
              ["validate", "preview"].includes(step) ? "bg-purple-500 text-white" : "bg-gray-600 text-gray-300"
            }`}>
              <Upload className="w-4 h-4" />
            </div>
            <span className="text-sm text-gray-300">选择文件</span>
          </div>

          <div className={`flex-1 h-0.5 mx-4 ${
            ["validate", "preview"].includes(step) ? "bg-purple-500" : "bg-gray-600"
          }`} />

          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              step === "validate" ? "bg-purple-600 text-white" :
              step === "preview" ? "bg-purple-500 text-white" : "bg-gray-600 text-gray-300"
            }`}>
              <CheckCircle className="w-4 h-4" />
            </div>
            <span className="text-sm text-gray-300">验证数据</span>
          </div>

          <div className={`flex-1 h-0.5 mx-4 ${
            step === "preview" ? "bg-purple-500" : "bg-gray-600"
          }`} />

          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              step === "preview" ? "bg-purple-600 text-white" : "bg-gray-600 text-gray-300"
            }`}>
              <Eye className="w-4 h-4" />
            </div>
            <span className="text-sm text-gray-300">预览确认</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <div className="space-y-4">
            {step === "upload" && (
            <>
              <div>
                <Label htmlFor="file-upload">选择Excel文件</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="mt-2"
                />
                <p className="text-sm text-gray-400 mt-1">
                  请使用我们提供的模板文件，支持 .xlsx 和 .xls 格式。<br/>
                  数据格式：粤音用|分隔，相关文献和视频切片格式为"名称-&gt;链接"
                </p>
              </div>

              {file && (
                <div className="flex items-center gap-2 p-3 bg-gray-800 border border-gray-700 rounded-lg">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-gray-200">{file.name}</span>
                  <span className="text-sm text-gray-400">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
            </>
          )}

          {step === "validate" && validationResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {validationResult.isValid ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium">
                  {validationResult.isValid ? "验证通过" : "验证失败"}
                </span>
              </div>

              {validationResult.isValid ? (
                <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <p className="text-green-300">
                      共发现 {validationResult.data.length} 条有效数据，可以进行上传
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-400" />
                    <p className="text-red-300 font-medium">发现以下错误：</p>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-red-300 text-sm ml-7">
                    {validationResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === "preview" && validationResult && validationResult.isValid && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-400" />
                <span className="font-medium text-gray-200">数据预览</span>
                <span className="text-sm text-gray-400">
                  （共 {validationResult.data.length} 条数据）
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto border border-gray-700 rounded-lg bg-gray-900/50">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-gray-800 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 text-left border-r border-gray-700 font-medium text-gray-300 w-16">#</th>
                      <th className="p-3 text-left border-r border-gray-700 font-medium text-gray-300 w-20">字符</th>
                      <th className="p-3 text-left border-r border-gray-700 font-medium text-gray-300 w-24">分类</th>
                      <th className="p-3 text-left border-r border-gray-700 font-medium text-gray-300 w-32">粤音</th>
                      <th className="p-3 text-left border-r border-gray-700 font-medium text-gray-300 w-80">组词</th>
                      <th className="p-3 text-left border-r border-gray-700 font-medium text-gray-300 w-80">句子</th>
                      <th className="p-3 text-left border-r border-gray-700 font-medium text-gray-300 w-64">相关文献</th>
                      <th className="p-3 text-left font-medium text-gray-300 w-64">视频切片</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.data.map((item, index) => (
                      <tr key={index} className="border-t border-gray-700 hover:bg-gray-800/50">
                        <td className="p-3 border-r border-gray-700 text-center text-gray-400">{index + 1}</td>
                        <td className="p-3 border-r border-gray-700 font-medium text-lg text-white">{item.data}</td>
                        <td className="p-3 border-r border-gray-700">
                          <span className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs">{item.category}</span>
                        </td>
                        <td className="p-3 border-r border-gray-700">
                          <div className="flex flex-wrap gap-1">
                            {item.pinyin.map((p: string, i: number) => (
                              <div key={i} className="bg-purple-900/50 text-purple-200 px-2 py-1 rounded text-xs border border-purple-600">
                                <Volume2 className="w-3 h-3 inline mr-1" />
                                {p}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 border-r border-gray-700">
                          <div className="space-y-1">
                            {item.meaning.map((m: string, i: number) => (
                              <div key={i} className="text-xs text-green-200 bg-green-900/30 px-2 py-1 rounded border border-green-700">
                                <BookOpen className="w-3 h-3 inline mr-1" />
                                {m}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 border-r border-gray-700">
                          <div className="space-y-1">
                            {item.sentence.map((s: string, i: number) => (
                              <div key={i} className="text-xs text-blue-200 bg-blue-900/30 px-2 py-1 rounded border border-blue-700" title={s}>
                                "{s}"
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 border-r border-gray-700">
                          <div className="space-y-1">
                            {item.related_documents.map((doc: any, i: number) => (
                              <div key={i} className="text-xs bg-orange-900/30 px-2 py-1 rounded border border-orange-700">
                                <BookOpen className="w-3 h-3 inline mr-1 text-orange-400" />
                                <span className="text-orange-200" title={doc.name}>{doc.name}</span>
                                {doc.link && (
                                  <a
                                    href={doc.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-400 ml-1 hover:text-orange-300"
                                  >
                                    <ExternalLink className="w-3 h-3 inline" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            {item.video_clips.map((clip: any, i: number) => (
                              <div key={i} className="text-xs bg-red-900/30 px-2 py-1 rounded border border-red-700">
                                <Video className="w-3 h-3 inline mr-1 text-red-400" />
                                <span className="text-red-200" title={clip.name}>{clip.name}</span>
                                {clip.link && (
                                  <a
                                    href={clip.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-red-400 ml-1 hover:text-red-300"
                                  >
                                    <ExternalLink className="w-3 h-3 inline" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-purple-900/20 border border-purple-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-purple-400" />
                  <p className="text-purple-200 text-sm">
                    请仔细检查上述数据是否正确。确认无误后点击"确认上传"按钮。
                  </p>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        <DialogFooter className="px-4 py-3 border-t border-gray-700">
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>

          {step === "upload" && (
            <Button
              onClick={handleValidate}
              disabled={!file || isValidating}
            >
              {isValidating ? "验证中..." : "验证数据"}
            </Button>
          )}

          {step === "validate" && (
            <>
              {!validationResult?.isValid && (
                <Button
                  variant="outline"
                  onClick={() => setStep("upload")}
                >
                  重新选择文件
                </Button>
              )}
            </>
          )}

          {step === "preview" && validationResult?.isValid && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("upload")}
              >
                重新选择文件
              </Button>
              <Button
                onClick={handleUpload}
                disabled={batchCreateMutation.isPending}
              >
                <Upload className="w-4 h-4 mr-2" />
                {batchCreateMutation.isPending ? "上传中..." : "确认上传"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { useCreateCorpusItem } from "@/lib/hooks/useDataAnnotation";
import { toast } from "sonner";

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateDialog({ open, onOpenChange, onSuccess }: CreateDialogProps) {
  const createMutation = useCreateCorpusItem();
  const [formData, setFormData] = useState({
    data: "",
    category: "zyzdv2",
    pinyin: [""],
    meaning: [""],
    sentence: [""],
    relatedDocs: [{ name: "", link: "" }],
    videoClips: [{ name: "", link: "" }],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 基本验证
    if (!formData.data.trim()) {
      toast.error("请输入字符");
      return;
    }

    if (formData.pinyin.every(p => !p.trim())) {
      toast.error("请至少输入一个粤音");
      return;
    }

    const noteData = {
      pinyin: formData.pinyin.filter(p => p.trim()),
      meaning: formData.meaning.filter(m => m.trim()),
      sentence: formData.sentence.filter(s => s.trim()),
      related_documents: formData.relatedDocs.filter(doc => doc.name.trim() || doc.link.trim()),
      video_clips: formData.videoClips.filter(clip => clip.name.trim() || clip.link.trim()),
    };

    createMutation.mutate({
      data: formData.data.trim(),
      category: formData.category,
      note: noteData,
    }, {
      onSuccess: () => {
        // 重置表单
        setFormData({
          data: "",
          category: "zyzdv2",
          pinyin: [""],
          meaning: [""],
          sentence: [""],
          relatedDocs: [{ name: "", link: "" }],
          videoClips: [{ name: "", link: "" }],
        });

        onOpenChange(false);
        onSuccess();
      }
    });
  };

  const addField = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as any[]), value]
    }));
  };

  const removeField = (field: keyof typeof formData, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as any[]).filter((_, i) => i !== index)
    }));
  };

  const updateField = (field: keyof typeof formData, index: number, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as any[]).map((item, i) => i === index ? value : item)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建新数据</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data">字符 *</Label>
              <Input
                id="data"
                value={formData.data}
                onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                placeholder="输入字符"
                required
              />
            </div>
            <div>
              <Label htmlFor="category">分类</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="分类"
              />
            </div>
          </div>

          {/* 粤音 */}
          <div>
            <Label>粤音 *</Label>
            {formData.pinyin.map((pinyin, index) => (
              <div key={index} className="flex items-center gap-2 mt-2">
                <Input
                  value={pinyin}
                  onChange={(e) => updateField("pinyin", index, e.target.value)}
                  placeholder={`粤音 ${index + 1}`}
                />
                {formData.pinyin.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => removeField("pinyin", index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addField("pinyin", "")}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加粤音
            </Button>
          </div>

          {/* 组词 */}
          <div>
            <Label>组词</Label>
            {formData.meaning.map((meaning, index) => (
              <div key={index} className="flex items-center gap-2 mt-2">
                <Textarea
                  value={meaning}
                  onChange={(e) => updateField("meaning", index, e.target.value)}
                  placeholder={`组词 ${index + 1}`}
                  rows={2}
                />
                {formData.meaning.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => removeField("meaning", index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addField("meaning", "")}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加组词
            </Button>
          </div>

          {/* 句子 */}
          <div>
            <Label>句子</Label>
            {formData.sentence.map((sentence, index) => (
              <div key={index} className="flex items-center gap-2 mt-2">
                <Textarea
                  value={sentence}
                  onChange={(e) => updateField("sentence", index, e.target.value)}
                  placeholder={`句子 ${index + 1}`}
                  rows={2}
                />
                {formData.sentence.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => removeField("sentence", index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addField("sentence", "")}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加句子
            </Button>
          </div>

          {/* 相关文献 */}
          <div>
            <Label>相关文献</Label>
            {formData.relatedDocs.map((doc, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mt-2">
                <Input
                  value={doc.name}
                  onChange={(e) => updateField("relatedDocs", index, { ...doc, name: e.target.value })}
                  placeholder="文献名称"
                />
                <div className="flex gap-2">
                  <Input
                    value={doc.link}
                    onChange={(e) => updateField("relatedDocs", index, { ...doc, link: e.target.value })}
                    placeholder="文献链接"
                  />
                  {formData.relatedDocs.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeField("relatedDocs", index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addField("relatedDocs", { name: "", link: "" })}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加文献
            </Button>
          </div>

          {/* 视频切片 */}
          <div>
            <Label>视频切片</Label>
            {formData.videoClips.map((clip, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mt-2">
                <Input
                  value={clip.name}
                  onChange={(e) => updateField("videoClips", index, { ...clip, name: e.target.value })}
                  placeholder="视频名称"
                />
                <div className="flex gap-2">
                  <Input
                    value={clip.link}
                    onChange={(e) => updateField("videoClips", index, { ...clip, link: e.target.value })}
                    placeholder="视频链接"
                  />
                  {formData.videoClips.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeField("videoClips", index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addField("videoClips", { name: "", link: "" })}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              添加视频
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
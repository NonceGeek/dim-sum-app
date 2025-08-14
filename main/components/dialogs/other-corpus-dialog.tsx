import * as OpenCC from 'opencc-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchResult } from "@/lib/api/search";
import { editApi } from "@/lib/api/edit-corpus";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store/useAuthStore";
import React, { useState, useEffect } from "react";

interface OtherCorpusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingResult: SearchResult | null;
}

interface ContextField {
  key: string;
  value: any;
  type: 'string' | 'array' | 'object';
}

export const OtherCorpusDialog = ({
  open,
  onOpenChange,
  editingResult,
}: OtherCorpusDialogProps) => {
  const [simplified, setSimplified] = useState("");
  const [traditional, setTraditional] = useState("");
  const [contextFields, setContextFields] = useState<ContextField[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthStore();

  // Check if user has tagger role
  const canEdit = user?.role === 'TAGGER_PARTNER' || user?.role === 'TAGGER_OUTSOURCING';

  useEffect(() => {
    if (editingResult) {
      if (editingResult.data) {
        const converter = OpenCC.Converter({ from: 'hk', to: 'cn' });
        setSimplified(converter(editingResult.data!));
      } else {
        setSimplified(editingResult.data);
      }

      setTraditional(editingResult.data);

      // 动态解析 context 中的所有字段
      const context = editingResult.note?.context || {};
      const fields: ContextField[] = [];
      
      Object.entries(context).forEach(([key, value]) => {
        if (key === 'trad') return; // 跳过繁体字段，因为已经单独处理
        
        let type: 'string' | 'array' | 'object' = 'string';
        if (Array.isArray(value)) {
          type = 'array';
        } else if (value && typeof value === 'object') {
          type = 'object';
        }
        
        fields.push({ key, value, type });
      });
      
      setContextFields(fields);
    }
  }, [editingResult]);

  const handleFieldChange = (index: number, value: any) => {
    const newFields = [...contextFields];
    newFields[index].value = value;
    setContextFields(newFields);
  };

  const handleArrayItemChange = (fieldIndex: number, itemIndex: number, value: string) => {
    const newFields = [...contextFields];
    const field = newFields[fieldIndex];
    if (Array.isArray(field.value)) {
      field.value[itemIndex] = value;
      setContextFields(newFields);
    }
  };

  const addArrayItem = (fieldIndex: number) => {
    const newFields = [...contextFields];
    const field = newFields[fieldIndex];
    if (Array.isArray(field.value)) {
      field.value.push('');
      setContextFields(newFields);
    }
  };

  const removeArrayItem = (fieldIndex: number, itemIndex: number) => {
    const newFields = [...contextFields];
    const field = newFields[fieldIndex];
    if (Array.isArray(field.value) && field.value.length > 1) {
      field.value.splice(itemIndex, 1);
      setContextFields(newFields);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // 重建 context 对象
      const updatedContext: any = {};
      contextFields.forEach(field => {
        updatedContext[field.key] = field.value;
      });

      const updatedData = {
        simplified,
        traditional,
        context: updatedContext,
      };

      const response = await editApi.updateCorpusItem({
        uuid: editingResult?.unique_id.toString(),
        note: updatedContext
      });
      toast.success(`Corpus data saved successfully. History ID: ${response.history_id}, Status: ${response.status}`);
      onOpenChange(false);
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save corpus data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: ContextField, index: number) => {
    switch (field.type) {
      case 'array':
        return (
          <div key={field.key} className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">{field.key}：</label>
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(index)}
                  className="h-8"
                >
                  添加{field.key}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {field.value.map((item: string, itemIndex: number) => (
                <div key={itemIndex} className="flex items-center gap-2">
                  <span className="text-sm font-medium w-16">
                    {field.key}{itemIndex + 1}：
                  </span>
                  <Input
                    value={item}
                    onChange={(e) => handleArrayItemChange(index, itemIndex, e.target.value)}
                    placeholder={`输入${field.key}${itemIndex + 1}`}
                    className="flex-1"
                    readOnly={!canEdit}
                  />
                  {canEdit && field.value.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem(index, itemIndex)}
                      className="h-8 w-8 p-0"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'object':
        return (
          <div key={field.key} className="space-y-2">
            <label className="block text-sm font-medium">{field.key}：</label>
            <Textarea
              value={JSON.stringify(field.value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleFieldChange(index, parsed);
                } catch (error) {
                  // 如果 JSON 解析失败，保持原值
                }
              }}
              placeholder={`输入${field.key}（JSON格式）`}
              className="min-h-[100px]"
              readOnly={!canEdit}
            />
          </div>
        );
      
      default:
        return (
          <div key={field.key} className="space-y-2">
            <label className="block text-sm font-medium">{field.key}：</label>
            <Input
              value={field.value || ''}
              onChange={(e) => handleFieldChange(index, e.target.value)}
              placeholder={`输入${field.key}`}
              className="w-full"
              readOnly={!canEdit}
            />
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {editingResult && (
          <div className="space-y-6">
                        <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium w-16">简体：</label>
                <Input
                  value={simplified}
                  onChange={(e) => setSimplified(e.target.value)}
                  placeholder={`输入简体`}
                  className="flex-1"
                  readOnly={!canEdit}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium w-16">繁体：</label>
                <Input
                  value={traditional}
                  onChange={(e) => setTraditional(e.target.value)}
                  placeholder={`输入繁体`}
                  className="flex-1"
                  readOnly={!canEdit}
                />
              </div>
            </div>
            <div>
            {contextFields.map((field, index) => renderField(field, index))}
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="h-12 px-6">
              {canEdit ? "Revert" : "Close"}
            </Button>
          </DialogClose>
          {canEdit && (
            <Button
              onClick={handleSave}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white h-12 px-6 ml-2"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

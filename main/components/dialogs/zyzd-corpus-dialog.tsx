import * as OpenCC from "opencc-js";
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
import { editApi } from "@/lib/api/edit";
import { toast } from "sonner";
import React, { useState, useEffect } from "react";

interface ZYZDCorpusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingResult: SearchResult | null;
}

export const ZYZDCorpusDialog = ({
  open,
  onOpenChange,
  editingResult,
}: ZYZDCorpusDialogProps) => {
  const [simplified, setSimplified] = useState("");
  const [traditional, setTraditional] = useState("");
  const [pinyinList, setPinyinList] = useState<string[]>([]);
  const [meanings, setMeanings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingResult) {
      if (editingResult.data) {
        const converter = OpenCC.Converter({ from: "hk", to: "cn" });
        setSimplified(converter(editingResult.data!));
      } else {
        setSimplified(editingResult.data);
      }

      setTraditional(editingResult.data || "");

      const pinyinData = editingResult.note?.context["pinyin"];
      if (Array.isArray(pinyinData) && pinyinData.length > 0) {
        setPinyinList([...pinyinData]);
      } else {
        setPinyinList([(editingResult.note?.context as any)["pinyin"] || ""]);
      }

      const meaningData = editingResult.note?.context["meaning"];
      if (Array.isArray(meaningData)) {
        setMeanings([...meaningData]);
      } else {
        setMeanings([meaningData || ""]);
      }
    }
  }, [editingResult]);

  const handlePinyinChange = (index: number, value: string) => {
    const newPinyinList = [...pinyinList];
    newPinyinList[index] = value;
    setPinyinList(newPinyinList);
  };

  const addPinyinRow = () => {
    setPinyinList([...pinyinList, ""]);
  };

  const removePinyinRow = (index: number) => {
    if (pinyinList.length > 1) {
      const newPinyinList = pinyinList.filter((_, i) => i !== index);
      setPinyinList(newPinyinList);
    }
  };

  const handleMeaningChange = (index: number, value: string) => {
    const newMeanings = [...meanings];
    newMeanings[index] = value;
    setMeanings(newMeanings);
  };

  const addMeaningRow = () => {
    setMeanings([...meanings, ""]);
  };

  const removeMeaningRow = (index: number) => {
    if (meanings.length > 1) {
      const newMeanings = meanings.filter((_, i) => i !== index);
      setMeanings(newMeanings);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const noteData = {
        pinyin: pinyinList,
        meaning: meanings,
        contributor: "Siri",
      };

      const response = await editApi.updateCorpusItem({
        uuid: editingResult?.unique_id.toString(),
        note: noteData,
      });

      toast.success(
        `Corpus data saved successfully. History ID: ${response.history_id}, Status: ${response.status}`
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save corpus data");
    } finally {
      setIsSubmitting(false);
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
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">粤音：</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPinyinRow}
                  className="h-8"
                >
                  添加粤音
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {pinyinList.map((pinyin, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm font-medium w-16">
                      粤音{index + 1}：
                    </span>
                    <Input
                      value={pinyin}
                      onChange={(e) =>
                        handlePinyinChange(index, e.target.value)
                      }
                      placeholder={`输入粤音${index + 1}`}
                      className="flex-1"
                    />
                    {pinyinList.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removePinyinRow(index)}
                        className="h-8 w-8 p-0"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">释义：</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMeaningRow}
                  className="h-8"
                >
                  添加释义
                </Button>
              </div>
              <div className="space-y-2">
                {meanings.map((meaning, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-sm font-medium w-16 mt-2">
                      释义{index + 1}：
                    </span>
                    <Textarea
                      value={meaning}
                      onChange={(e) =>
                        handleMeaningChange(index, e.target.value)
                      }
                      placeholder={`输入释义${index + 1}`}
                      className="flex-1 min-h-[60px]"
                    />
                    {meanings.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeMeaningRow(index)}
                        className="h-8 w-8 p-0 mt-2"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="h-12 px-6">
              Revert
            </Button>
          </DialogClose>
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white h-12 px-6 ml-2"
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

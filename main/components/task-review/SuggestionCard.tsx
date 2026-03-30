"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { BlockEditor } from "./BlockEditor";
import type {
  ContentBlock,
  CantonesePronunciationItem,
  CantonesePronunciationRecord,
  BlockType,
} from "@/lib/types/task-review";

const ADDABLE_BLOCK_TYPES: { type: BlockType; key: string }[] = [
  { type: "phrase", key: "phrase" },
  { type: "sentence", key: "sentence" },
  { type: "definition", key: "definition" },
  { type: "introduction", key: "introduction" },
  { type: "audio", key: "audio" },
  { type: "emotion", key: "emotion" },
  { type: "other", key: "other" },
];

interface SuggestionCardProps {
  index: number;
  sourceName: string;
  record: CantonesePronunciationRecord;
  canEdit: boolean;
  canDelete: boolean;
  taskId?: string;
  showHeader?: boolean;
  onChange: (record: CantonesePronunciationRecord) => void;
  onAddPronunciation: () => void;
}

export function SuggestionCard({
  index,
  sourceName,
  record,
  canEdit,
  canDelete,
  taskId,
  showHeader = true,
  onChange,
  onAddPronunciation,
}: SuggestionCardProps) {
  const t = useTranslations("TaskReview");
  const [openItems, setOpenItems] = useState<Set<number>>(() => {
    if (record.data.length <= 2) {
      return new Set(record.data.map((_, idx) => idx));
    }
    return new Set([0]);
  });

  const toggleItem = (idx: number) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleTextChange = (text: string) => {
    onChange({ ...record, text });
  };

  const handleJyutpingChange = (itemIndex: number, jyutping: string) => {
    const newData = [...record.data];
    newData[itemIndex] = { ...newData[itemIndex], jyutping };
    onChange({ ...record, data: newData });
  };

  const handleBlockChange = (
    itemIndex: number,
    blockIndex: number,
    updatedBlock: ContentBlock
  ) => {
    const newData = [...record.data];
    const newBlocks = [...newData[itemIndex].blocks];
    newBlocks[blockIndex] = updatedBlock;
    newData[itemIndex] = { ...newData[itemIndex], blocks: newBlocks };
    onChange({ ...record, data: newData });
  };

  const handleBlockDelete = (itemIndex: number, blockIndex: number) => {
    const newData = [...record.data];
    const newBlocks = newData[itemIndex].blocks.filter((_, i) => i !== blockIndex);
    newData[itemIndex] = { ...newData[itemIndex], blocks: newBlocks };
    onChange({ ...record, data: newData });
  };

  const handleAddBlock = (itemIndex: number, type: BlockType) => {
    const newData = [...record.data];
    const newBlock: ContentBlock = { type, new: true };
    if (type === "emotion") {
      newBlock.category = "";
      newBlock.intensity = "";
    }
    const newBlocks = [...newData[itemIndex].blocks, newBlock];
    newData[itemIndex] = { ...newData[itemIndex], blocks: newBlocks };
    onChange({ ...record, data: newData });
  };

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {t("option", { index: index + 1 })}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("dataSource", { source: sourceName })}
          </span>
        </div>
      )}

      {/* Origin Text */}
      <div>
        <label className="text-xs text-muted-foreground">{t("originText")}</label>
        <Input
          value={record.text || ""}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={!canEdit}
          className="mt-1"
        />
      </div>

      {/* Pronunciation Items */}
      <div className="space-y-2">
        {record.data.map((item: CantonesePronunciationItem, itemIndex: number) => (
          <Collapsible
            key={itemIndex}
            open={openItems.has(itemIndex)}
            onOpenChange={() => toggleItem(itemIndex)}
          >
            <div className="border rounded-lg">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent/50 rounded-t-lg">
                <div className="flex items-center gap-2">
                  {openItems.has(itemIndex) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {t("cantonesePronunciation")}: {item.jyutping || "—"}
                  </span>
                  {item.new && (
                    <span className="text-xs text-blue-500">NEW</span>
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent className="px-3 pb-3 space-y-2">
                {/* Jyutping Input */}
                <div>
                  <label className="text-xs text-muted-foreground">
                    {t("cantonesePronunciation")}
                  </label>
                  <Input
                    value={item.jyutping || ""}
                    onChange={(e) => handleJyutpingChange(itemIndex, e.target.value)}
                    disabled={!canEdit}
                    className="mt-1"
                    placeholder={t("enterJyutping")}
                  />
                </div>

                {/* Blocks */}
                <div className="space-y-1">
                  {item.blocks.map((block: ContentBlock, blockIndex: number) => (
                    <BlockEditor
                      key={blockIndex}
                      block={block}
                      taskId={taskId}
                      onChange={(updated) =>
                        handleBlockChange(itemIndex, blockIndex, updated)
                      }
                      onDelete={() => handleBlockDelete(itemIndex, blockIndex)}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  ))}
                </div>

                {/* Add Block Dropdown */}
                {canEdit && (
                  <div className="pt-2 border-t">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {t("addContentBlock")}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-36">
                        {ADDABLE_BLOCK_TYPES.map((bt) => (
                          <DropdownMenuItem
                            key={bt.type}
                            onClick={() => handleAddBlock(itemIndex, bt.type)}
                          >
                            {t(bt.key as Parameters<typeof t>[0])}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>

      {/* Add Pronunciation */}
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onAddPronunciation}
        >
          <Plus className="w-4 h-4 mr-1" />
          {t("addPronunciation")}
        </Button>
      )}
    </Card>
  );
}

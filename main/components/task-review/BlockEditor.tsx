"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AudioRecorder } from "./AudioRecorder";
import { EmotionPicker } from "./EmotionPicker";
import type { ContentBlock, BlockType } from "@/lib/types/task-review";

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  phrase: "phrase",
  sentence: "sentence",
  definition: "definition",
  introduction: "introduction",
  audio: "audio",
  emotion: "emotion",
  other: "other",
};

interface BlockEditorProps {
  block: ContentBlock;
  taskId?: string;
  onChange: (updated: ContentBlock) => void;
  onDelete?: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function BlockEditor({
  block,
  taskId,
  onChange,
  onDelete,
  canEdit,
  canDelete,
}: BlockEditorProps) {
  const t = useTranslations("TaskReview");

  const label = t(BLOCK_TYPE_LABELS[block.type] as Parameters<typeof t>[0]);

  const handleContentChange = (content: string) => {
    onChange({ ...block, content });
  };

  if (block.type === "audio") {
    return (
      <div className="flex items-center justify-between gap-2 py-1">
        <span className="text-xs text-muted-foreground font-medium shrink-0 w-12">
          {label}
        </span>
        <div className="flex-1">
          <AudioRecorder
            url={block.url}
            duration={block.duration}
            taskId={taskId}
            onAudioSaved={(url, duration) => onChange({ ...block, url, duration })}
            disabled={!canEdit}
          />
        </div>
        {canDelete && onDelete && block.new && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive h-7 px-2">
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  }

  if (block.type === "emotion") {
    return (
      <div className="flex items-center justify-between gap-2 py-1">
        <span className="text-xs text-muted-foreground font-medium shrink-0 w-12">
          {label}
        </span>
        <div className="flex-1">
          <EmotionPicker
            category={block.category}
            intensity={block.intensity}
            onCategoryChange={(category) => onChange({ ...block, category })}
            onIntensityChange={(intensity) => onChange({ ...block, intensity })}
            disabled={!canEdit}
          />
        </div>
        {canDelete && onDelete && block.new && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive h-7 px-2">
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  }

  // Text-based blocks: phrase, sentence, definition, introduction, other
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <span className="text-xs text-muted-foreground font-medium shrink-0 w-12 pt-2">
        {label}
      </span>
      <div className="flex-1">
        <Textarea
          value={block.content || ""}
          onChange={(e) => handleContentChange(e.target.value)}
          disabled={!canEdit}
          rows={1}
          className="min-h-[36px] text-sm resize-none"
        />
      </div>
      {canDelete && onDelete && block.new && (
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive h-7 px-2 mt-1">
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}

"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { EMOTION_CATEGORIES, INTENSITY_LEVELS } from "@/lib/types/task-review";

interface EmotionPickerProps {
  category?: string;
  intensity?: string;
  onCategoryChange: (value: string) => void;
  onIntensityChange: (value: string) => void;
  disabled?: boolean;
}

export function EmotionPicker({
  category,
  intensity,
  onCategoryChange,
  onIntensityChange,
  disabled,
}: EmotionPickerProps) {
  const t = useTranslations("TaskReview");

  return (
    <div className="flex items-center gap-2">
      <Select value={category || ""} onValueChange={onCategoryChange} disabled={disabled}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t("selectEmotion")} />
        </SelectTrigger>
        <SelectContent>
          {EMOTION_CATEGORIES.map((e) => (
            <SelectItem key={e} value={e}>
              {e}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={intensity || ""} onValueChange={onIntensityChange} disabled={disabled}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder={t("selectIntensity")} />
        </SelectTrigger>
        <SelectContent>
          {INTENSITY_LEVELS.map((level) => (
            <SelectItem key={level} value={level}>
              {level}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

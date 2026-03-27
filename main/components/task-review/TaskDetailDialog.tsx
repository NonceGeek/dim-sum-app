"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTask, useCompleteTask, useSkipTask, useViewTask, useUserTaskPermissions } from "@/lib/hooks/useTaskReview";
import { useCategoryStore } from "@/lib/stores/category-store";
import { SuggestionCard } from "./SuggestionCard";
import type {
  AgentTask,
  TaskDetail,
  TaskSuggestion,
  CantonesePronunciationRecord,
  ContentBlock,
  UserTaskPermissions,
  SuggestionAuth,
} from "@/lib/types/task-review";

interface TaskDetailDialogProps {
  task: AgentTask | null;
  open: boolean;
  onClose: () => void;
}

const SOURCE_NAME_DEFAULT = "llm";

/**
 * Get the corpus source key for a suggestion, matching mini-program getSourceInfo.
 */
function getSourceKey(
  suggestion: TaskSuggestion,
  corpusName: string | undefined
): string {
  if (suggestion.kind === "llm") return SOURCE_NAME_DEFAULT;
  if (suggestion.kind === "baseline") return suggestion.lexiconBaseCorpusName || "";
  return corpusName || "";
}

/**
 * Compute per-suggestion auth permissions, matching mini-program getAuthCorpus.
 */
function getAuthCorpus(
  suggestions: TaskSuggestion[],
  corpusName: string | undefined,
  permissions: UserTaskPermissions | undefined
): SuggestionAuth {
  if (!permissions) {
    return { canEdit: [], canAdd: false, canDelete: false };
  }

  const corpusFromData = suggestions.map((s) => getSourceKey(s, corpusName));

  const { role, isSystemAdmin, writeCorpora } = permissions;

  if (isSystemAdmin) {
    return { canEdit: corpusFromData, canAdd: true, canDelete: true };
  }
  if (role === "RESEARCHER") {
    return { canEdit: corpusFromData, canAdd: true, canDelete: false };
  }
  if (role === "TAGGER_PARTNER" || role === "TAGGER_OUTSOURCING") {
    const corpusSet = new Set(corpusFromData);
    return {
      canEdit: [
        ...writeCorpora.filter((w) => corpusSet.has(w)),
        SOURCE_NAME_DEFAULT,
      ],
      canAdd: false,
      canDelete: false,
    };
  }
  return { canEdit: [SOURCE_NAME_DEFAULT], canAdd: false, canDelete: false };
}

function buildSuggestionsFromTask(detail: TaskDetail): TaskSuggestion[] {
  if (detail.suggestions && detail.suggestions.length > 0) {
    const first = detail.suggestions[0] as unknown as Record<string, unknown>;
    if (first.record) {
      const rich = detail.suggestions as unknown as TaskSuggestion[];
      // phonetic_mismatch: ensure cantonesePronunciations is populated
      if (detail.violationType === "phonetic_mismatch") {
        return rich.map((s) => {
          if (s.record.data.length === 0 && s.value) {
            return {
              ...s,
              record: {
                ...s.record,
                text: s.record.text || detail.context.sentenceText || "",
                data: [{ jyutping: s.value, blocks: [] }],
              },
            };
          }
          return s;
        });
      }
      return rich;
    }
  }

  // Fallback: build from raw suggestions
  return (detail.suggestions || []).map((s) => {
    const raw = s as unknown as { kind?: string; value?: string; lexiconBaseCorpusName?: string };
    const kind = (raw.kind || "llm") as TaskSuggestion["kind"];
    const value = raw.value;

    // phonetic_mismatch: wrap value into cantonesePronunciations
    if (detail.violationType === "phonetic_mismatch" && value) {
      return {
        kind,
        value,
        lexiconBaseCorpusName: raw.lexiconBaseCorpusName,
        record: {
          text: detail.context.sentenceText || "",
          data: [{ jyutping: value, blocks: [] }],
        },
      };
    }

    return {
      kind,
      value,
      lexiconBaseCorpusName: raw.lexiconBaseCorpusName,
      record: {
        text: detail.context.sentenceText || "",
        data: [],
      },
    };
  }) as TaskSuggestion[];
}

function getSourceName(
  suggestion: TaskSuggestion,
  corpusName: string | undefined,
  getNickname: (name: string) => string
): string {
  if (suggestion.kind === "llm") return "LLM";
  if (suggestion.kind === "baseline") {
    const name = suggestion.lexiconBaseCorpusName;
    return name ? getNickname(name) : "Baseline";
  }
  return corpusName ? getNickname(corpusName) : "Original";
}

function checkCanSubmit(suggestions: TaskSuggestion[], currentIndex: number): boolean {
  const current = suggestions[currentIndex];
  if (!current) return false;
  if (!current.record.text) return false;
  return current.record.data.some((item) => item.jyutping?.trim());
}

function checkEmotion(suggestions: TaskSuggestion[]): string | null {
  for (const suggestion of suggestions) {
    for (const item of suggestion.record.data) {
      for (const block of item.blocks) {
        if (block.type === "emotion") {
          const hasCategory = !!block.category;
          const hasIntensity = !!block.intensity;
          if (hasCategory !== hasIntensity) {
            return "emotionRequired";
          }
        }
      }
    }
  }
  return null;
}

function cleanBlocksForSubmit(blocks: ContentBlock[]): ContentBlock[] {
  return blocks
    .filter((b) => {
      if (b.type === "audio") return !!b.url;
      if (b.type === "emotion") return !!b.category && !!b.intensity;
      return !!b.content?.trim();
    })
    .map(({ new: _, ...rest }) => rest);
}

/**
 * Check if a suggestion has been modified from its initial state.
 */
function hasUnsavedChanges(
  current: TaskSuggestion | undefined,
  initial: TaskSuggestion | undefined
): boolean {
  if (!current || !initial) return false;
  return JSON.stringify(current.record) !== JSON.stringify(initial.record);
}

export function TaskDetailDialog({ task, open, onClose }: TaskDetailDialogProps) {
  const t = useTranslations("TaskReview");
  const { data: taskDetail, isLoading } = useTask(task?.id ?? null);
  const { data: permissions } = useUserTaskPermissions();
  const completeMutation = useCompleteTask();
  const skipMutation = useSkipTask();
  const viewMutation = useViewTask();
  const { fetchCategories, getNickname } = useCategoryStore();

  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [initialSuggestions, setInitialSuggestions] = useState<TaskSuggestion[]>([]);
  const [selectedTab, setSelectedTab] = useState("0");
  const [confirmAction, setConfirmAction] = useState<"skip" | "switch" | null>(null);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const isCompleted = task?.status === "completed";
  const currentIndex = parseInt(selectedTab, 10) || 0;
  const canSubmit = suggestions.length > 0 && checkCanSubmit(suggestions, currentIndex);

  // Compute per-suggestion auth based on role and corpus permissions
  const auth = useMemo(
    () => getAuthCorpus(suggestions, task?.context.corpusName, permissions),
    [suggestions, task?.context.corpusName, permissions]
  );

  // Ref for stable access in keyboard handler
  const submitRef = useRef<() => void>(undefined);

  // Fetch categories for Chinese source names
  useEffect(() => {
    if (open) fetchCategories();
  }, [open, fetchCategories]);

  // Initialize suggestions from task detail
  useEffect(() => {
    if (taskDetail) {
      const built = buildSuggestionsFromTask(taskDetail as unknown as TaskDetail);
      setSuggestions(built);
      setInitialSuggestions(JSON.parse(JSON.stringify(built)));
      setSelectedTab("0");
    }
  }, [taskDetail]);

  // Mark task as viewed
  useEffect(() => {
    if (task?.id && open) {
      viewMutation.mutate(task.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, open]);

  const handleSuggestionChange = useCallback(
    (index: number, record: CantonesePronunciationRecord) => {
      setSuggestions((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], record };
        return next;
      });
    },
    []
  );

  const handleAddPronunciation = useCallback(
    (index: number) => {
      setSuggestions((prev) => {
        const next = [...prev];
        const newData = [
          ...next[index].record.data,
          {
            jyutping: "",
            blocks: [
              { type: "phrase" as const, content: "", new: true },
              { type: "sentence" as const, content: "", new: true },
            ],
            new: true,
          },
        ];
        next[index] = {
          ...next[index],
          record: { ...next[index].record, data: newData },
        };
        return next;
      });
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!task) return;

    const emotionError = checkEmotion(suggestions);
    if (emotionError) return;

    const idx = parseInt(selectedTab, 10) || 0;
    const currentSuggestion = suggestions[idx];
    if (!currentSuggestion) return;

    const cleaned = {
      ...currentSuggestion,
      record: {
        ...currentSuggestion.record,
        data: currentSuggestion.record.data
          .filter((item) => item.jyutping?.trim())
          .map((item) => ({
            ...item,
            blocks: cleanBlocksForSubmit(item.blocks),
            new: undefined,
          })),
      },
    };

    await completeMutation.mutateAsync({
      id: task.id,
      selected: [cleaned],
    });
    onClose();
  }, [task, suggestions, selectedTab, completeMutation, onClose]);

  // Keep ref in sync for keyboard handler
  useEffect(() => {
    submitRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleSkip = () => {
    setConfirmAction("skip");
  };

  const handleConfirmSkip = async () => {
    if (!task) return;
    await skipMutation.mutateAsync(task.id);
    onClose();
    setConfirmAction(null);
  };

  // Tab switching with unsaved changes detection
  const handleTabChange = useCallback(
    (newTab: string) => {
      if (isCompleted) {
        setSelectedTab(newTab);
        return;
      }
      const idx = parseInt(selectedTab, 10) || 0;
      if (hasUnsavedChanges(suggestions[idx], initialSuggestions[idx])) {
        setPendingTab(newTab);
        setConfirmAction("switch");
      } else {
        setSelectedTab(newTab);
      }
    },
    [selectedTab, suggestions, initialSuggestions, isCompleted]
  );

  const handleConfirmSwitch = async () => {
    // Submit current changes, then switch
    await handleSubmit();
    if (pendingTab !== null) {
      setSelectedTab(pendingTab);
    }
    setConfirmAction(null);
    setPendingTab(null);
  };

  const handleDiscardSwitch = () => {
    // Discard changes: revert current suggestion to initial state
    const idx = parseInt(selectedTab, 10) || 0;
    setSuggestions((prev) => {
      const next = [...prev];
      if (initialSuggestions[idx]) {
        next[idx] = JSON.parse(JSON.stringify(initialSuggestions[idx]));
      }
      return next;
    });
    if (pendingTab !== null) {
      setSelectedTab(pendingTab);
    }
    setConfirmAction(null);
    setPendingTab(null);
  };

  // Keyboard shortcut: Cmd/Ctrl+Enter → submit
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submitRef.current?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  /**
   * Compute canEdit/canDelete for a specific suggestion index.
   * When completed, nothing is editable.
   * Otherwise, check if the suggestion's source key is in auth.canEdit.
   */
  const getSuggestionPerms = useCallback(
    (idx: number) => {
      if (isCompleted) return { canEdit: false, canDelete: false };
      const suggestion = suggestions[idx];
      if (!suggestion) return { canEdit: false, canDelete: false };
      const sourceKey = getSourceKey(suggestion, task?.context.corpusName);
      const canEdit = auth.canEdit.includes(sourceKey);
      const canDelete = auth.canDelete;
      return { canEdit, canDelete };
    },
    [isCompleted, suggestions, task?.context.corpusName, auth]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <div className="border-b px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {t("taskDetail")}
                {isCompleted && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {t("processed")}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-3 mt-3">
              {task?.context.sentenceText && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {task.context.sentenceText}
                </p>
              )}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                {t("noTasks")}
              </div>
            ) : suggestions.length === 1 ? (
              (() => {
                const perms = getSuggestionPerms(0);
                return (
                  <SuggestionCard
                    index={0}
                    sourceName={getSourceName(suggestions[0], task?.context.corpusName, getNickname)}
                    record={suggestions[0].record}
                    canEdit={perms.canEdit}
                    canDelete={perms.canDelete}
                    taskId={task?.id}
                    onChange={(record) => handleSuggestionChange(0, record)}
                    onAddPronunciation={() => handleAddPronunciation(0)}
                  />
                );
              })()
            ) : (
              <Tabs value={selectedTab} onValueChange={handleTabChange}>
                <TabsList
                  className="w-full grid mb-4"
                  style={{ gridTemplateColumns: `repeat(${suggestions.length}, 1fr)` }}
                >
                  {suggestions.map((suggestion, idx) => (
                    <TabsTrigger key={idx} value={String(idx)}>
                      {getSourceName(suggestion, task?.context.corpusName, getNickname)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {suggestions.map((suggestion, idx) => {
                  const perms = getSuggestionPerms(idx);
                  return (
                    <TabsContent key={idx} value={String(idx)}>
                      <SuggestionCard
                        index={idx}
                        sourceName={getSourceName(suggestion, task?.context.corpusName, getNickname)}
                        record={suggestion.record}
                        canEdit={perms.canEdit}
                        canDelete={perms.canDelete}
                        taskId={task?.id}
                        showHeader={false}
                        onChange={(record) => handleSuggestionChange(idx, record)}
                        onAddPronunciation={() => handleAddPronunciation(idx)}
                      />
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </div>

          {/* Footer */}
          {!isCompleted && !isLoading && suggestions.length > 0 && (
            <div className="shrink-0 border-t px-6 py-5">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={handleSkip}
                  disabled={skipMutation.isPending || completeMutation.isPending}
                >
                  {skipMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  {t("skip")}
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  onClick={handleSubmit}
                  disabled={!canSubmit || completeMutation.isPending || skipMutation.isPending}
                >
                  {completeMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  {t("submit")}
                  {!completeMutation.isPending && (
                    <kbd className="ml-2 text-[10px] opacity-50 font-sans">⌘↵</kbd>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog — Skip */}
      <AlertDialog open={confirmAction === "skip"} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmSkip")}</AlertDialogTitle>
            <AlertDialogDescription />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSkip}>
              {skipMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Dialog — Unsaved changes on tab switch */}
      <AlertDialog
        open={confirmAction === "switch"}
        onOpenChange={() => {
          setConfirmAction(null);
          setPendingTab(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>提示</AlertDialogTitle>
            <AlertDialogDescription>
              是否保存并提交当前编辑内容？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardSwitch}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwitch}>
              {completeMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              )}
              确定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

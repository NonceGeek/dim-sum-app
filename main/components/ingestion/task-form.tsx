"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  FileIcon,
  FolderUpIcon,
  Loader2Icon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import {
  CONTENT_ATTRIBUTES,
  type ContentAttribute,
  defaultTaskTitle,
  type IngestionType,
  isMediaPath,
  MEDIA_DIR,
  normalizeModalities,
  TASK_MODALITIES,
  type TaskModality,
} from "@/lib/ingestion/task-options";
import { cn } from "@/lib/utils";
import { json } from "@/components/library-ops/ops-shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "./task-shared";
import { uploadFiles } from "./task-panels";
import type { TaskDetail, TaskFile } from "./types";

type Dataset = { name: string; nickname: string | null; contentAttribute: string; profileModalities: string[] };
type DatasetOverview = { name: string; count: number; mediaTypes: string[] };

/** 从入库待办发起时由待办页带入 */
export type LeadPrefill = {
  id: string;
  leadNo: string;
  datasetName: string;
  ingestionType: string;
};

/** 选中或拖入的文件，path 为相对路径（来自文件夹时带目录） */
type Picked = { file: File; path: string };

/** 本页发起、尚未出现在任务文件列表里的上传 */
type Upload = { file: File; path: string; state: "uploading" | "done" | "error"; error?: string };

const MEDIA_ACCEPT: Record<Exclude<TaskModality, "text">, string> = {
  audio: "audio/*",
  video: "video/*",
  image: "image/*",
};
const TEXT_ACCEPT = ".xls,.xlsx,.csv,.doc,.docx,.pdf,.txt,.json,.zip";

/** 语料集公开资料用的模态词表与任务不同：image_video 对应视频与图片 */
function profileToTask(values: string[]) {
  return normalizeModalities(values.flatMap((v) => (v === "image_video" ? ["video", "image"] : [v])));
}

/**
 * 新建入库任务 / 编辑草稿：保存草稿，或保存后进入对话开始智能清洗。
 * 文件选中即上传；新建时第一次选文件会先自动保存草稿，任务工作区就是 Agent 读取的目录。
 */
export function TaskForm({ task, lead }: { task?: TaskDetail; lead?: LeadPrefill }) {
  const t = useTranslations("IngestionTasks");
  const router = useRouter();
  const queryClient = useQueryClient();

  const initialType: IngestionType =
    task?.targetIngestionType ?? (lead?.ingestionType === "new_dataset" ? "new_dataset" : "supplement_existing");
  const initialName = task?.targetDatasetName ?? lead?.datasetName ?? "";
  const [type, setType] = useState<IngestionType>(initialType);
  const [existingName, setExistingName] = useState(initialType === "supplement_existing" ? initialName : "");
  const [newName, setNewName] = useState(initialType === "new_dataset" ? initialName : "");
  const [contentAttribute, setContentAttribute] = useState<ContentAttribute>(
    task?.targetContentAttribute ?? "oral",
  );
  const [modalities, setModalities] = useState<TaskModality[]>(task?.modalities ?? ["text"]);
  const [title, setTitle] = useState(task?.title ?? "");
  // 标题未手动改过时跟随语料集名生成
  const [titleEdited, setTitleEdited] = useState(!!task);
  const [source, setSource] = useState(task?.sourceCollectionMethod ?? "");
  const [note, setNote] = useState(task?.description ?? "");
  const [taskId, setTaskId] = useState(task?.id);
  const [uploads, setUploads] = useState<Upload[]>([]);
  // 并发选文件时只建一个草稿
  const creating = useRef<Promise<string> | null>(null);
  const [saving, setSaving] = useState<"draft" | "start" | null>(null);
  // 选中语料集后按它已有的媒体组成预填一次；从待办带入的语料集同样预填
  const prefillFor = useRef<string | null>(task ? null : initialName || null);

  const datasetName = (type === "supplement_existing" ? existingName : newName).trim();
  const autoTitle = datasetName ? defaultTaskTitle(datasetName) : "";

  const detail = useQuery({
    queryKey: ["ingestion-task", taskId],
    enabled: !!taskId,
    initialData: task,
    queryFn: async () => json<TaskDetail>(await fetch(`/api/admin/ingestion-tasks/${taskId}`)),
  });

  const datasets = useQuery({
    queryKey: ["ingestion-datasets"],
    queryFn: async () => json<{ items: Dataset[] }>(await fetch("/api/admin/ingestion-tasks/datasets")),
    staleTime: 5 * 60_000,
  });
  const selected = datasets.data?.items.find((d) => d.name === existingName);
  const overview = useQuery({
    queryKey: ["ingestion-dataset", existingName],
    enabled: type === "supplement_existing" && !!existingName,
    queryFn: async () =>
      json<DatasetOverview>(
        await fetch(`/api/admin/ingestion-tasks/datasets?${new URLSearchParams({ name: existingName })}`),
      ),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!overview.data || prefillFor.current !== overview.data.name) return;
    prefillFor.current = null;
    setModalities((current) => normalizeModalities([...current, ...overview.data.mediaTypes]));
  }, [overview.data]);

  // 待办里的拟定名称不一定是已有语料集，对不上时让用户重新选择
  useEffect(() => {
    if (task || !datasets.data || !existingName) return;
    if (!datasets.data.items.some((d) => d.name === existingName)) setExistingName("");
  }, [task, datasets.data, existingName]);

  const selectDataset = (name: string) => {
    setExistingName(name);
    const dataset = datasets.data?.items.find((d) => d.name === name);
    setModalities(profileToTask(dataset?.profileModalities ?? []));
    prefillFor.current = name;
  };

  const mediaModalities = modalities.filter((m): m is Exclude<TaskModality, "text"> => m !== "text");
  const uploaded = detail.data?.files ?? [];
  const uploadedText = uploaded.filter((f) => !isMediaPath(f.path));
  const uploadedMedia = uploaded.filter((f) => isMediaPath(f.path));
  const hasText = uploadedText.some((f) => f.status === "UPLOADED");
  const uploading = uploads.some((u) => u.state === "uploading");

  const saveConfig = async (id: string | undefined) =>
    json<TaskDetail>(
      await fetch(id ? `/api/admin/ingestion-tasks/${id}` : "/api/admin/ingestion-tasks", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetIngestionType: type,
          targetDatasetName: datasetName,
          targetContentAttribute: type === "new_dataset" ? contentAttribute : undefined,
          modalities,
          sourceCollectionMethod: source,
          title: titleEdited ? title : autoTitle,
          description: note,
          leadId: id ? undefined : lead?.id,
        }),
      }),
    );

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: ["ingestion-tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["ingestion-leads"] });
  };

  /** 还没有任务时先存草稿，并把地址换成草稿页（不重新渲染，上传继续） */
  const ensureTask = () => {
    if (taskId) return Promise.resolve(taskId);
    creating.current ??= saveConfig(undefined).then(
      (saved) => {
        queryClient.setQueryData(["ingestion-task", saved.id], saved);
        setTaskId(saved.id);
        refreshLists();
        window.history.replaceState(null, "", window.location.pathname.replace(/\/new$/, `/${saved.id}`));
        return saved.id;
      },
      (error: Error) => {
        creating.current = null;
        throw error;
      },
    );
    return creating.current;
  };

  const upload = async (items: { file: File; path: string }[]) => {
    const paths = new Set(items.map((i) => i.path));
    setUploads((current) => [
      ...current.filter((u) => !paths.has(u.path)),
      ...items.map((i) => ({ ...i, state: "uploading" as const })),
    ]);
    const settle = (path: string, error?: string) =>
      setUploads((current) =>
        current.map((u) => (u.path === path ? { ...u, state: error ? "error" : "done", error } : u)),
      );
    let id: string;
    try {
      id = await ensureTask();
    } catch (error) {
      const message = (error as Error).message;
      items.forEach((i) => settle(i.path, message));
      return toast.error(message);
    }
    await uploadFiles(id, items, settle);
    await queryClient.invalidateQueries({ queryKey: ["ingestion-task", id] });
    // 已出现在任务文件列表里的不再单独显示
    setUploads((current) => current.filter((u) => !(paths.has(u.path) && u.state === "done")));
  };

  const addFiles = (kind: "text" | "media", items: Picked[]) => {
    if (!taskId && !datasetName) return toast.error(t("create.datasetFirst"));
    void upload(items.map((i) => ({ file: i.file, path: kind === "media" ? `${MEDIA_DIR}/${i.path}` : i.path })));
  };

  const dismiss = (path: string) => setUploads((current) => current.filter((u) => u.path !== path));

  const submit = async (action: "draft" | "start") => {
    if (!datasetName) return toast.error(t("create.datasetRequired"));
    if (action === "start" && !source.trim()) return toast.error(t("create.sourceRequired"));
    if (action === "start" && !hasText) return toast.error(t("create.textRequired"));
    setSaving(action);
    try {
      const saved = await saveConfig(taskId);
      queryClient.setQueryData(["ingestion-task", saved.id], saved);
      refreshLists();
      if (action === "start") return router.push(`/admin/ingestion-tasks/${saved.id}?start=1`);
      toast.success(t("create.draftSaved"));
      router.push("/admin/ingestion-tasks");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const modalityLabel = (values: readonly string[]) =>
    normalizeModalities(values)
      .map((m) => t(`modality.${m}`))
      .join(" + ");

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{taskId ? t("create.editTitle") : t("create.title")}</h2>
          <p className="text-muted-foreground">
            {lead ? t("create.fromLead", { no: lead.leadNo }) : t("create.description")}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/ingestion-tasks">
            <ArrowLeftIcon className="size-4" />
            {t("back")}
          </Link>
        </Button>
      </div>

      <form
        className="max-w-5xl rounded-xl border bg-card"
        onSubmit={(e) => {
          e.preventDefault();
          void submit("start");
        }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="font-semibold">{t("create.cardTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t.rich("create.requiredHint", { mark: (chunks) => <span className="text-destructive">{chunks}</span> })}
          </p>
        </div>

        <div className="space-y-10 p-6">
          <Section title={t("create.steps.dataset")}>
            <Field label={t("create.datasetMode")} required>
              <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                {(["supplement_existing", "new_dataset"] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={type === mode ? "secondary" : "ghost"}
                    className={cn(type === mode && "bg-background text-primary shadow-sm")}
                    onClick={() => setType(mode)}
                  >
                    {t(`create.ingestionType.${mode}`)}
                  </Button>
                ))}
              </div>
            </Field>

            {type === "supplement_existing" ? (
              <>
                <Field label={t("create.existingDataset")} htmlFor="task-dataset" required>
                  <select
                    id="task-dataset"
                    value={existingName}
                    onChange={(e) => selectDataset(e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">{datasets.isLoading ? t("loading") : t("create.chooseDataset")}</option>
                    {datasets.data?.items.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.nickname && d.nickname !== d.name ? `${d.nickname}（${d.name}）` : d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {existingName && (
                  <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-primary">{selected?.nickname || existingName}</p>
                      <span className="text-xs text-muted-foreground">{t("create.existingBadge")}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {selected && selected.contentAttribute !== "unclassified" && (
                        <Tag className="bg-purple-500/10 text-purple-700 dark:text-purple-300">
                          {t.has(`contentAttribute.${selected.contentAttribute}`)
                            ? t(`contentAttribute.${selected.contentAttribute}`)
                            : selected.contentAttribute}
                        </Tag>
                      )}
                      {overview.data && (
                        <>
                          <Tag>{modalityLabel(overview.data.mediaTypes)}</Tag>
                          <Tag>{t("create.recordCount", { count: overview.data.count })}</Tag>
                        </>
                      )}
                      {overview.isLoading && <span className="text-muted-foreground">{t("loading")}</span>}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="grid gap-6 rounded-lg border border-primary/20 bg-primary/5 p-4 md:grid-cols-2">
                  <Field label={t("create.newDataset")} htmlFor="task-new-dataset" required>
                    <Input
                      id="task-new-dataset"
                      maxLength={200}
                      placeholder={t("create.newDatasetPlaceholder")}
                      className="bg-background"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </Field>
                  <Field label={t("create.contentAttribute")} htmlFor="task-content-attribute" required>
                    <select
                      id="task-content-attribute"
                      value={contentAttribute}
                      onChange={(e) => setContentAttribute(e.target.value as ContentAttribute)}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      {CONTENT_ATTRIBUTES.map((value) => (
                        <option key={value} value={value}>
                          {t(`contentAttribute.${value}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">{t("create.datasetHint")}</p>
              </div>
            )}
          </Section>

          <Section title={t("create.steps.modalities")}>
            <div className="space-y-4 rounded-lg border p-5">
              <Label>
                {t("create.modalities")} <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-3">
                {TASK_MODALITIES.map((m) => {
                  const checked = modalities.includes(m);
                  return (
                    <label
                      key={m}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2.5 text-sm",
                        checked && "border-primary/40 bg-primary/5 text-primary",
                        m === "text" && "cursor-default",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={m === "text"}
                        onCheckedChange={(value) =>
                          setModalities((current) =>
                            normalizeModalities(value ? [...current, m] : current.filter((c) => c !== m)),
                          )
                        }
                      />
                      {m === "text" ? t("create.textRequiredOption") : t(`modality.${m}`)}
                    </label>
                  );
                })}
              </div>
              <p className="rounded-md border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                {mediaModalities.length
                  ? t("create.mediaHint", { combo: modalityLabel(modalities) })
                  : t("create.textOnlyHint")}
              </p>
            </div>
          </Section>

          <Section title={t("create.steps.files")}>
            <p className="-mt-2 text-xs text-muted-foreground">{t("create.filesHint")}</p>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label={t("create.textFiles")} required>
                <DropZone
                  title={t("create.textDropTitle")}
                  hint={t("create.textDropHint")}
                  accept={TEXT_ACCEPT}
                  onFiles={(files) => addFiles("text", files)}
                />
                <FileList
                  uploaded={uploadedText}
                  uploads={uploads.filter((u) => !u.path.startsWith(`${MEDIA_DIR}/`))}
                  onRetry={(u) => void upload([{ file: u.file, path: u.path }])}
                  onDismiss={dismiss}
                />
              </Field>
              <Field label={t("create.mediaFiles")}>
                <DropZone
                  title={t("create.mediaDropTitle")}
                  hint={
                    mediaModalities.length
                      ? t("create.mediaDropHint", { types: mediaModalities.map((m) => t(`modality.${m}`)).join("、") })
                      : t("create.mediaDropDisabled")
                  }
                  accept={mediaModalities.map((m) => MEDIA_ACCEPT[m]).join(",")}
                  disabled={!mediaModalities.length}
                  folder
                  onFiles={(files) => addFiles("media", files)}
                />
                <FileList
                  uploaded={uploadedMedia}
                  uploads={uploads.filter((u) => u.path.startsWith(`${MEDIA_DIR}/`))}
                  onRetry={(u) => void upload([{ file: u.file, path: u.path }])}
                  onDismiss={dismiss}
                />
              </Field>
            </div>
          </Section>

          <Section title={t("create.steps.info")}>
            <Field label={t("fields.sourceCollectionMethod")} htmlFor="task-source" required>
              <Textarea
                id="task-source"
                rows={3}
                maxLength={2000}
                placeholder={t("create.sourcePlaceholder")}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </Field>
            <Field label={t("fields.description")} htmlFor="task-note">
              <Textarea
                id="task-note"
                rows={3}
                maxLength={2000}
                placeholder={t("create.notePlaceholder")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <Field label={t("fields.title")} htmlFor="task-title" hint={t("create.titleHint")}>
              <Input
                id="task-title"
                maxLength={200}
                placeholder={autoTitle}
                value={titleEdited ? title : autoTitle}
                onChange={(e) => {
                  setTitleEdited(true);
                  setTitle(e.target.value);
                }}
              />
            </Field>
          </Section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-xl border-t bg-card/95 px-6 py-4 backdrop-blur">
          <p className="mr-auto text-xs text-muted-foreground">
            {uploading ? t("create.uploadsInProgress") : t("create.startHint")}
          </p>
          <Button type="button" variant="outline" disabled={!!saving || uploading} onClick={() => void submit("draft")}>
            {saving === "draft" ? t("saving") : t("create.saveDraft")}
          </Button>
          <Button type="submit" disabled={!!saving || uploading}>
            <SparklesIcon className="size-4" />
            {saving === "start" ? t("saving") : t("create.start")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <h4 className="border-b pb-3 font-semibold">{title}</h4>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("rounded-full bg-primary/10 px-2.5 py-0.5 text-primary", className)}>{children}</span>;
}

function DropZone({
  title,
  hint,
  accept,
  disabled,
  folder,
  onFiles,
}: {
  title: string;
  hint: string;
  accept: string;
  disabled?: boolean;
  folder?: boolean;
  onFiles: (items: Picked[]) => void;
}) {
  const t = useTranslations("IngestionTasks.files");
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  // 文件夹里的文件不受 accept 限制，按 accept 过滤掉 .DS_Store 等无关文件；单独选中的文件照常上传
  const deliver = (items: Picked[]) => {
    const kept = items.filter((i) => !i.path.includes("/") || matchesAccept(i.file, accept));
    if (kept.length < items.length) toast.info(t("skipped", { count: items.length - kept.length }));
    if (kept.length) onFiles(kept);
  };
  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    deliver(files.map((file) => ({ file, path: file.webkitRelativePath || file.name })));
  };
  // 隐藏 input 的 click 会冒泡到外层，触发外层的「选择文件」
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && fileInput.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          fileInput.current?.click();
        }
      }}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled || !e.dataTransfer.items.length) return;
        collectDropped(e.dataTransfer).then(deliver, (error: Error) => toast.error(error.message));
      }}
      className={cn(
        "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/[0.02] p-6 text-center transition-colors",
        over && "border-primary bg-primary/5",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input ref={fileInput} type="file" multiple hidden accept={accept} onClick={stop} onChange={pick} />
      {folder && (
        <input
          ref={folderInput}
          type="file"
          hidden
          onClick={stop}
          onChange={pick}
          {...({ webkitdirectory: "" } as Record<string, string>)}
        />
      )}
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ArrowUpIcon className="size-5" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {folder && !disabled && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            folderInput.current?.click();
          }}
        >
          <FolderUpIcon className="size-4" />
          {t("pickFolder")}
        </Button>
      )}
    </div>
  );
}

/** 按 input 的 accept 规则（.ext、type/*、完整 MIME）判断文件是否可接受 */
function matchesAccept(file: File, accept: string) {
  const name = file.name.toLowerCase();
  return accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .some((rule) =>
      rule.startsWith(".")
        ? name.endsWith(rule)
        : rule.endsWith("/*")
          ? file.type.startsWith(rule.slice(0, -1))
          : file.type === rule,
    );
}

/** 拖入的条目里文件夹要逐层展开，dataTransfer.files 只给出文件夹本身 */
async function collectDropped(transfer: DataTransfer) {
  const entries = [...transfer.items]
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => entry !== null);
  const collected: Picked[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      collected.push({ file, path: entry.fullPath.replace(/^\//, "") });
      return;
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries 每次只返回一批，读到空为止
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) await walk(child);
    }
  };
  for (const entry of entries) await walk(entry);
  return collected;
}

function FileList({
  uploaded,
  uploads,
  onRetry,
  onDismiss,
}: {
  uploaded: TaskFile[];
  uploads: Upload[];
  onRetry: (upload: Upload) => void;
  onDismiss: (path: string) => void;
}) {
  const t = useTranslations("IngestionTasks");
  // 上传中的文件在任务里已有一条「上传中」记录，以本页的状态为准
  const local = new Set(uploads.map((u) => `input/${u.path}`));
  const files = uploaded.filter((f) => !local.has(f.path));
  if (!files.length && !uploads.length) return null;
  return (
    <ul className="divide-y rounded-md border text-sm">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-2 px-3 py-2">
          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs" title={f.path}>
            {f.path.replace(/^input\//, "")}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatBytes(f.size)}</span>
          <span className={cn("shrink-0 text-xs", f.status === "UPLOADED" ? "text-muted-foreground" : "text-destructive")}>
            {t(`files.status.${f.status}`)}
          </span>
        </li>
      ))}
      {uploads.map((u) => (
        <li key={u.path} className="flex items-center gap-2 px-3 py-2">
          {u.state === "uploading" ? (
            <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : u.state === "done" ? (
            <CheckCircle2Icon className="size-4 shrink-0 text-success" />
          ) : (
            <FileIcon className="size-4 shrink-0 text-destructive" />
          )}
          <span className="min-w-0 flex-1 truncate font-mono text-xs" title={u.error ?? u.path}>
            {u.path}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatBytes(u.file.size)}</span>
          {u.state === "error" ? (
            <>
              <span className="max-w-[40%] shrink-0 truncate text-xs text-destructive" title={u.error}>
                {u.error}
              </span>
              <button type="button" className="shrink-0 text-xs text-primary hover:underline" onClick={() => onRetry(u)}>
                {t("create.retry")}
              </button>
              <button
                type="button"
                aria-label={t("create.removeFile")}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => onDismiss(u.path)}
              >
                <XIcon className="size-4" />
              </button>
            </>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">
              {t(`files.status.${u.state === "done" ? "UPLOADED" : "UPLOADING"}`)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** 入库任务的语料集配置；表单页也会引用，不能依赖 node 模块 */

/** 与 ingestion_leads.target_ingestion_type 同值；任务上只有这两种 */
export const INGESTION_TYPES = ["supplement_existing", "new_dataset"] as const;
export type IngestionType = (typeof INGESTION_TYPES)[number];

/** 取自 CONTRIBUTION_MODALITIES；文字必选 */
export const TASK_MODALITIES = ["text", "audio", "video", "image"] as const;
export type TaskModality = (typeof TASK_MODALITIES)[number];

/** 按固定顺序去重，并补上必选的文字 */
export function normalizeModalities(values: readonly string[]): TaskModality[] {
  return TASK_MODALITIES.filter((m) => m === "text" || values.includes(m));
}

/** 关联媒体上传到 input/media/ 下，与文本主文件分开 */
export const MEDIA_DIR = "media";
export const isMediaPath = (path: string) => path.startsWith(`input/${MEDIA_DIR}/`);

/** 草稿：还没开始对话的待开始任务，可以继续修改配置 */
export const isDraft = (taskStatus: string, hasRun: boolean) => taskStatus === "PENDING" && !hasRun;

/** 默认任务标题：语料集名 · 上海日期 */
export function defaultTaskTitle(datasetName: string, now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now);
  return `${datasetName.trim()} · ${day}`;
}

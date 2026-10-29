"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangleIcon,
  BanIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleIcon,
  DatabaseIcon,
  FileTextIcon,
  FolderUpIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlayIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { buildTimeline, type TimelineNode } from "@/lib/ingestion/timeline";
import { cn } from "@/lib/utils";
import { ReportPanel, useTaskReports } from "./report-panel";
import { ApprovalDetail, FilesPanel, RecordsPanel } from "./task-panels";
import { FormattedTime } from "./task-shared";
import type { RunView, TaskDetail } from "./types";

/** 右栏：任务配置（折叠）+ 按时间排列的任务里程碑，最后一个高亮节点就是现在所处的位置 */
export function TaskTimeline({ task, run }: { task: TaskDetail; run: RunView | null }) {
  const reports = useTaskReports(task.id);
  const latest = reports.data?.reports[0] ?? null;
  const nodes = buildTimeline(task, run, latest);
  return (
    <div className="flex flex-col gap-3">
      <TaskConfig task={task} />
      <ol className="relative space-y-1 rounded-lg border p-3 before:absolute before:top-6 before:bottom-6 before:left-[23px] before:w-px before:bg-border">
        {nodes.map((node) => (
          <TimelineItem
            key={node.key}
            node={node}
            task={task}
            // 已发生的节点默认收起，只展开等你处理的节点与还需上传文件的入口
            defaultOpen={node.state === "now" || (node.kind === "files" && node.count === 0 && task.canUploadFiles)}
          />
        ))}
      </ol>
    </div>
  );
}

function TaskConfig({ task }: { task: TaskDetail }) {
  const t = useTranslations("IngestionTasks");
  const summary = [
    t(`create.ingestionType.${task.targetIngestionType}`),
    task.targetContentAttribute && t(`contentAttribute.${task.targetContentAttribute}`),
    task.modalities.map((m) => t(`modality.${m}`)).join(" + "),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <details className="group rounded-lg border px-4 py-2.5 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-1.5">
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="font-medium">{t("timeline.config")}</span>
        <span className="min-w-0 truncate text-muted-foreground">· {summary}</span>
      </summary>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-muted-foreground">{t("fields.targetDatasetName")}</dt>
        <dd className="break-all">{task.targetDatasetName}</dd>
        <dt className="text-muted-foreground">{t("fields.targetIngestionType")}</dt>
        <dd>{t(`create.ingestionType.${task.targetIngestionType}`)}</dd>
        {task.targetContentAttribute && (
          <>
            <dt className="text-muted-foreground">{t("fields.targetContentAttribute")}</dt>
            <dd>{t(`contentAttribute.${task.targetContentAttribute}`)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{t("fields.modalities")}</dt>
        <dd>{task.modalities.map((m) => t(`modality.${m}`)).join(" + ")}</dd>
        <dt className="text-muted-foreground">{t("fields.assignee")}</dt>
        <dd>{task.assigneeName}</dd>
        {task.lead && (
          <>
            <dt className="text-muted-foreground">{t("fields.lead")}</dt>
            <dd>
              <Link
                href={`/admin/ingestion-leads?${new URLSearchParams({ lead: task.lead.id })}`}
                className="underline underline-offset-4"
              >
                {task.lead.leadNo}
              </Link>
            </dd>
          </>
        )}
        {task.sourceCollectionMethod && (
          <>
            <dt className="col-span-2 mt-1 border-t pt-2 text-muted-foreground">{t("fields.sourceCollectionMethod")}</dt>
            <dd className="col-span-2 whitespace-pre-line">{task.sourceCollectionMethod}</dd>
          </>
        )}
        {task.description && (
          <>
            <dt className="col-span-2 mt-1 border-t pt-2 text-muted-foreground">{t("fields.description")}</dt>
            <dd className="col-span-2 whitespace-pre-line">{task.description}</dd>
          </>
        )}
      </dl>
    </details>
  );
}

function TimelineItem({ node, task, defaultOpen }: { node: TimelineNode; task: TaskDetail; defaultOpen: boolean }) {
  const t = useTranslations("IngestionTasks");
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const { icon, title, meta, body, chat } = describe(node, task, t);
  // 跳回对话中的对应位置，复用详情页 ?turn=&toolCall= 的定位与高亮
  const openInChat =
    chat?.toolCallId &&
    (() =>
      router.replace(
        `/admin/ingestion-tasks/${task.id}?${new URLSearchParams({
          ...(chat.turnId ? { turn: chat.turnId } : {}),
          toolCall: chat.toolCallId!,
        })}`,
        { scroll: false },
      ));

  return (
    <li className="relative flex gap-3">
      <span
        className={cn(
          "z-10 mt-1 grid size-5 shrink-0 place-items-center rounded-full border bg-background [&_svg]:size-3",
          node.state === "done" && "text-success",
          node.state === "now" && "border-warning bg-warning/10 text-warning",
          node.state === "stopped" && "text-muted-foreground",
          node.state === "todo" && "border-dashed text-muted-foreground/50",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 py-1">
        <button
          type="button"
          disabled={!body}
          onClick={() => setOpen(!open)}
          className={cn(
            "flex w-full items-center gap-1 text-left text-sm",
            node.state === "now" && "font-medium",
            node.state === "todo" && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1">{title}</span>
          {body && (
            <ChevronRightIcon className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
          )}
        </button>
        {meta && <p className={cn("text-xs text-muted-foreground", node.state === "now" && "text-warning")}>{meta}</p>}
        {open && body && (
          <div className="mt-2 space-y-2">
            {body}
            {openInChat && (
              <button type="button" onClick={openInChat} className="text-xs text-primary underline-offset-4 hover:underline">
                {t("timeline.viewInChat")}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

type Described = {
  icon: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;
  chat?: { turnId: string | null; toolCallId: string | null };
};

function describe(node: TimelineNode, task: TaskDetail, t: ReturnType<typeof useTranslations<"IngestionTasks">>): Described {
  const by = (name: string | null, at: string) => (
    <>
      {name && `${name} · `}
      <FormattedTime value={at} />
    </>
  );
  switch (node.kind) {
    case "created":
      return { icon: <PlusIcon />, title: t("timeline.created"), meta: by(node.by, node.at) };
    case "files":
      return {
        icon: <FolderUpIcon />,
        title: node.count ? t("timeline.files", { count: node.count }) : t("timeline.noFiles"),
        meta: node.count ? (
          <>
            {node.failed > 0 && <span className="text-destructive">{t("timeline.filesFailed", { count: node.failed })} · </span>}
            <FormattedTime value={node.at} />
          </>
        ) : undefined,
        body: <FilesPanel task={task} />,
      };
    case "session":
      return { icon: <PlayIcon />, title: t("timeline.session"), meta: by(node.by, node.at) };
    case "question": {
      const q = node.question;
      return {
        icon: <MessageSquareIcon />,
        title: t("timeline.question", { count: q.headers.length }),
        meta: (
          <>
            {t(`timeline.questionStatus.${q.status}`)} · <FormattedTime value={q.resolvedAt ?? q.createdAt} />
          </>
        ),
        body: (
          <ul className="space-y-1 text-xs">
            {q.headers.map((header, i) => (
              <li key={`${i}:${header}`}>
                <span className="text-muted-foreground">{header}</span>
                {q.answers?.[i] && <span> → {q.answers[i]}</span>}
              </li>
            ))}
          </ul>
        ),
        chat: q,
      };
    }
    case "approval": {
      const a = node.approval;
      return {
        icon: <ShieldCheckIcon />,
        // 提案摘要由 Agent 撰写、可能很长，放进展开内容；标题固定为短文案
        title: t("approvals.plan", { count: a.steps.length }),
        meta: (
          <>
            {t(`approvals.status.${a.status}`)}
            {a.decidedByName && a.decidedAt ? <> · {by(a.decidedByName, a.decidedAt)}</> : <> · <FormattedTime value={a.createdAt} /></>}
          </>
        ),
        body: <ApprovalDetail approval={a} />,
        chat: a,
      };
    }
    case "write":
      return {
        icon: <DatabaseIcon />,
        title: t("timeline.write", { count: node.operation.recordCount }),
        meta: (
          <>
            {t("timeline.approvedBy", { name: node.operation.approvedByName })} · <FormattedTime value={node.at} />
          </>
        ),
        body: (
          <>
            {node.approval && <ApprovalDetail approval={node.approval} />}
            <RecordsPanel taskId={task.id} operationId={node.operation.id} />
          </>
        ),
        chat: node.operation,
      };
    case "report":
      return {
        icon: node.generating ? <Loader2Icon className="animate-spin" /> : <FileTextIcon />,
        title: t("timeline.report", { version: node.version, kind: t(`report.kinds.${node.reportKind}`) }),
        meta: <FormattedTime value={node.at} />,
        body: <ReportPanel task={task} />,
      };
    case "end":
      return {
        icon: node.outcome === "completed" ? <CheckCircle2Icon /> : <BanIcon />,
        title: t(`timeline.end.${node.outcome}`),
        meta: by(node.by, node.at),
      };
    case "working":
      return { icon: <Loader2Icon className="animate-spin" />, title: t("timeline.working") };
    case "error":
      return {
        icon: <AlertTriangleIcon />,
        title: t("timeline.error"),
        meta: t("timeline.errorHint"),
        body: node.message ? <p className="text-xs whitespace-pre-line text-destructive">{node.message}</p> : undefined,
      };
    case "next":
      return { icon: <CircleIcon />, title: t("timeline.next") };
  }
}

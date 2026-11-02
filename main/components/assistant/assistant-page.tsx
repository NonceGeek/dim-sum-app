"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PanelLeft, SquarePen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  useAssistantConversation,
  useAssistantConversations,
  useDeleteAssistantConversation,
  type AssistantConversationSummary,
} from "@/lib/api/assistant";
import { cn } from "@/lib/utils";
import { AssistantChat } from "./assistant-chat";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIDEBAR_STORAGE_KEY = "assistant-sidebar-open";
const DAY_MS = 24 * 60 * 60 * 1000;

type GroupKey = "today" | "week" | "earlier";

function groupConversations(conversations: AssistantConversationSummary[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const groups: Record<GroupKey, AssistantConversationSummary[]> = { today: [], week: [], earlier: [] };
  for (const conversation of conversations) {
    const updated = new Date(conversation.updatedAt).getTime();
    if (updated >= startOfToday.getTime()) groups.today.push(conversation);
    else if (updated >= startOfToday.getTime() - 6 * DAY_MS) groups.week.push(conversation);
    else groups.earlier.push(conversation);
  }
  return (["today", "week", "earlier"] as const).filter((key) => groups[key].length).map((key) => ({ key, items: groups[key] }));
}

function ConversationList({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("Assistant");
  const { data: conversations, isLoading } = useAssistantConversations();
  const deleteConversation = useDeleteAssistantConversation();

  if (isLoading) {
    return (
      <div className="space-y-2 px-1">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (!conversations?.length) {
    return <p className="px-3 text-sm text-muted-foreground">{t("noHistory")}</p>;
  }

  return (
    <div className="space-y-5">
      {groupConversations(conversations).map((group) => (
        <div key={group.key}>
          <div className="px-3 pb-1 text-xs text-muted-foreground">{t(`group.${group.key}`)}</div>
          {group.items.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-center rounded-lg text-sm transition-colors hover:bg-background/70",
                conversation.id === activeId && "bg-background shadow-xs",
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate px-3 py-2 text-left"
                onClick={() => onSelect(conversation.id)}
              >
                {conversation.title || t("untitled")}
              </button>
              <button
                type="button"
                aria-label={t("deleteChat")}
                className="mr-1.5 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                onClick={() => {
                  if (!window.confirm(t("deleteConfirm"))) return;
                  deleteConversation.mutate(conversation.id, {
                    onSuccess: () => {
                      if (conversation.id === activeId) onSelect("");
                    },
                    onError: () => toast.error(t("error")),
                  });
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg text-muted-foreground hover:text-foreground"
    >
      {children}
    </Button>
  );
}

export function AssistantPage() {
  const t = useTranslations("Assistant");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlId = searchParams.get("c");
  // 首页“问小助手”带过来的问题，新对话里自动发送
  const initialQuery = searchParams.get("q")?.trim() || undefined;
  const existingId = urlId && UUID_PATTERN.test(urlId) ? urlId : null;
  // 新对话的 id 在前端生成，首条消息时由服务端创建会话
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeId = existingId ?? draftId;
  // 本页新建的会话写入地址栏后仍沿用正在进行的对话，不重新加载
  const isDraft = !existingId || existingId === draftId;
  const conversation = useAssistantConversation(isDraft ? null : existingId);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "false") setSidebarOpen(false);
    } catch {
      // 浏览器存储不可用时保持默认展开
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((open) => {
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!open));
      } catch {
        // 忽略存储失败
      }
      return !open;
    });
  };

  const startNew = () => {
    setSheetOpen(false);
    setDraftId(crypto.randomUUID());
    router.push(pathname);
  };
  const select = (id: string) => {
    if (!id) return startNew();
    setSheetOpen(false);
    // 点击当前正在看的会话不做任何事，避免打断正在生成的回答
    if (id === activeId) return;
    router.push(`${pathname}?c=${id}`);
  };

  // 离开本页新建的会话后换一个新的草稿 id：再回到那个会话时按已有会话从服务端加载历史，
  // 否则会被当成未发送的草稿，显示空白的新对话
  useEffect(() => {
    if (existingId && existingId !== draftId) setDraftId(crypto.randomUUID());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingId]);

  let chat: React.ReactNode;
  if (isDraft) {
    chat = (
      <AssistantChat
        key={draftId}
        conversationId={draftId}
        initialMessages={[]}
        initialQuery={existingId ? undefined : initialQuery}
        // 地址栏记录会话 id，刷新后可继续；replace 不触发重新挂载
        onFirstMessage={() => window.history.replaceState(null, "", `${window.location.pathname}?c=${draftId}`)}
      />
    );
  } else if (conversation.isLoading) {
    chat = (
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-8">
        <Skeleton className="ml-auto h-10 w-1/3 rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  } else if (conversation.isError || !conversation.data) {
    chat = (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <p>{t("notFound")}</p>
        <Button variant="link" onClick={startNew}>
          {t("newChat")}
        </Button>
      </div>
    );
  } else {
    chat = (
      <AssistantChat
        key={activeId}
        conversationId={activeId}
        initialMessages={conversation.data.messages}
      />
    );
  }

  const sidebarBody = (
    <>
      <button
        type="button"
        onClick={startNew}
        className="mb-4 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-background/70"
      >
        <SquarePen className="size-4" />
        {t("newChat")}
      </button>
      <ConversationList activeId={activeId} onSelect={select} />
    </>
  );

  return (
    <div className="flex h-full gap-2 p-2">
      {/* 桌面端侧栏：浅色圆角面板，可收起 */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col overflow-hidden rounded-2xl bg-muted/50 transition-[width] duration-200 md:flex",
          sidebarOpen ? "w-64" : "w-0",
        )}
      >
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-sm font-medium">{t("history")}</span>
          <IconButton label={t("collapseSidebar")} onClick={toggleSidebar}>
            <PanelLeft className="size-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{sidebarBody}</div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* 移动端是独立一行，桌面端悬浮在左上角，避免压住消息 */}
        <div className="flex gap-1 px-1 pb-1 md:absolute md:top-1 md:left-1 md:z-10 md:p-0">
          {/* 移动端打开抽屉；桌面端侧栏收起时显示展开与新对话 */}
          <span className="md:hidden">
            <IconButton label={t("history")} onClick={() => setSheetOpen(true)}>
              <PanelLeft className="size-4" />
            </IconButton>
          </span>
          {!sidebarOpen && (
            <span className="hidden md:inline-flex">
              <IconButton label={t("expandSidebar")} onClick={toggleSidebar}>
                <PanelLeft className="size-4" />
              </IconButton>
            </span>
          )}
          <span className={cn(sidebarOpen && "md:hidden")}>
            <IconButton label={t("newChat")} onClick={startNew}>
              <SquarePen className="size-4" />
            </IconButton>
          </span>
        </div>
        <div className="min-h-0 flex-1">{chat}</div>
      </main>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-72 border-0 bg-muted p-3">
          <SheetHeader className="p-0 pb-3">
            <SheetTitle className="text-sm">{t("history")}</SheetTitle>
          </SheetHeader>
          {sidebarBody}
        </SheetContent>
      </Sheet>
    </div>
  );
}

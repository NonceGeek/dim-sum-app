"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { History, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  useAssistantConversation,
  useAssistantConversations,
  useDeleteAssistantConversation,
} from "@/lib/api/assistant";
import { cn } from "@/lib/utils";
import { AssistantChat } from "./assistant-chat";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ConversationList({
  activeId,
  onSelect,
  onNew,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const t = useTranslations("Assistant");
  const { data: conversations, isLoading } = useAssistantConversations();
  const deleteConversation = useDeleteAssistantConversation();

  return (
    <div className="flex h-full flex-col gap-3">
      <Button variant="outline" className="justify-start gap-2" onClick={onNew}>
        <MessageSquarePlus className="h-4 w-4" />
        {t("newChat")}
      </Button>
      <div className="px-1 text-xs font-medium text-muted-foreground">{t("history")}</div>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {isLoading &&
          Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}
        {!isLoading && !conversations?.length && (
          <p className="px-1 text-sm text-muted-foreground">{t("noHistory")}</p>
        )}
        {conversations?.map((conversation) => (
          <div
            key={conversation.id}
            className={cn(
              "group flex items-center rounded-md text-sm hover:bg-accent",
              conversation.id === activeId && "bg-accent",
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate px-2 py-1.5 text-left"
              onClick={() => onSelect(conversation.id)}
            >
              {conversation.title || t("untitled")}
            </button>
            <button
              type="button"
              aria-label={t("deleteChat")}
              className="mr-1 rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
              onClick={() => {
                if (!window.confirm(t("deleteConfirm"))) return;
                deleteConversation.mutate(conversation.id, {
                  onSuccess: () => {
                    if (conversation.id === activeId) onNew();
                  },
                  onError: () => toast.error(t("error")),
                });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssistantPage() {
  const t = useTranslations("Assistant");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlId = searchParams.get("c");
  const existingId = urlId && UUID_PATTERN.test(urlId) ? urlId : null;
  // 新对话的 id 在前端生成，首条消息时由服务端创建会话
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeId = existingId ?? draftId;
  // 本页新建的会话写入地址栏后仍沿用正在进行的对话，不重新加载
  const isDraft = !existingId || existingId === draftId;
  const conversation = useAssistantConversation(isDraft ? null : existingId);

  const select = (id: string) => {
    setSheetOpen(false);
    router.push(`${pathname}?c=${id}`);
  };
  const startNew = () => {
    setSheetOpen(false);
    setDraftId(crypto.randomUUID());
    router.push(pathname);
  };

  const list = <ConversationList activeId={activeId} onSelect={select} onNew={startNew} />;

  let chat: React.ReactNode;
  if (isDraft) {
    chat = (
      <AssistantChat
        key={draftId}
        conversationId={draftId}
        initialMessages={[]}
        // 地址栏记录会话 id，刷新后可继续；replace 不触发重新挂载
        onFirstMessage={() => window.history.replaceState(null, "", `${window.location.pathname}?c=${draftId}`)}
      />
    );
  } else if (conversation.isLoading) {
    chat = (
      <div className="space-y-4 p-6">
        <Skeleton className="ml-auto h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  } else if (conversation.isError || !conversation.data) {
    chat = (
      <div className="p-10 text-center text-sm text-muted-foreground">
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

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl">
      <aside className="hidden h-full w-60 shrink-0 border-r p-3 md:block">
        {list}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-4 py-2 md:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <History className="h-4 w-4" />
                {t("history")}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader className="p-0 pb-3">
                <SheetTitle>{t("title")}</SheetTitle>
              </SheetHeader>
              {list}
            </SheetContent>
          </Sheet>
          <Button variant="ghost" size="sm" className="gap-2" onClick={startNew}>
            <MessageSquarePlus className="h-4 w-4" />
            {t("newChat")}
          </Button>
        </div>
        <div className="min-h-0 flex-1">{chat}</div>
      </main>
    </div>
  );
}

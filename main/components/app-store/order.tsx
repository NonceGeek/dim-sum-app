"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { appJson } from "./favorites";

type OrderItem = { id: string; name: string };
type Order = { version: string; items: OrderItem[] };
const endpoint = "/api/admin/applications/order";

export function AppOrderDialog({ onClose }: { onClose: () => void }) {
  const en = useLocale() === "en";
  const L = (zh: string, english: string) => en ? english : zh;
  const cache = useQueryClient();
  const order = useQuery({
    queryKey: ["admin-application-order"],
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) => fetch(endpoint, { cache: "no-store", signal }).then(appJson<Order>),
  });
  const [draft, setDraft] = useState<{ original: Order; items: OrderItem[] } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const items = draft?.items ?? order.data?.items ?? [];
  const editable = !saving && !conflict && !order.isFetching && !order.isError;
  const changed = draft?.items.some(({ id }, index) => id !== draft.original.items[index].id);

  function move(from: number, to: number) {
    if (!editable || !order.data || from < 0 || from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setDraft({ original: draft?.original ?? order.data, items: next });
    setAnnouncement(L(`${item.name} 已移到第 ${to + 1} 位`, `${item.name} moved to position ${to + 1}`));
  }

  async function reload() {
    const result = await order.refetch();
    if (result.isError) return;
    setConflict(false);
    setDraft(null);
    setAnnouncement("");
  }

  async function save() {
    if (!draft || !editable || !changed) return;
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: draft.original.version,
          ids: items.map(({ id }) => id),
        }),
      });
      if (response.status === 409) {
        setConflict(true);
        return;
      }
      if (!response.ok) throw new Error("Could not save application order");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["admin-application-order"] }),
        cache.invalidateQueries({ queryKey: ["admin-applications"] }),
        cache.invalidateQueries({ queryKey: ["app-store"] }),
        cache.invalidateQueries({ queryKey: ["app-favorites"] }),
      ]);
      toast.success(L("应用顺序已保存", "Application order saved"));
      onClose();
    } catch {
      toast.error(L("保存顺序失败，请重试。", "Could not save the order. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{L("调整推荐顺序", "Adjust recommended order")}</DialogTitle>
          <DialogDescription>
            {L("拖拽或使用上移、下移按钮。保存后，应用商店的推荐列表和各分类会采用此顺序。",
              "Drag apps or use the move buttons. Saving updates the recommended order in the App Store and its categories.")}
          </DialogDescription>
        </DialogHeader>
        {(conflict || order.isError) && (
          <div className="flex flex-wrap items-center gap-2 text-sm" role="alert">
            <p>{conflict
              ? L("应用列表已更新，请加载最新顺序后重新调整。", "The app list changed. Load the latest order before editing again.")
              : L("加载顺序失败，请重试。", "Could not load the order. Please try again.")}</p>
            <Button size="sm" variant="outline" disabled={order.isFetching} onClick={() => void reload()}>
              {L("加载最新顺序", "Load latest order")}
            </Button>
          </div>
        )}
        <p className="sr-only" aria-live="polite">{announcement}</p>
        {order.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">{L("正在加载应用…", "Loading apps…")}</p>
        ) : items.length > 0 ? (
          <ol className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={`flex items-center gap-2 px-2 py-2 ${draggedId === item.id ? "opacity-50" : ""}`}
                onDragOver={(event) => { if (editable && draggedId) event.preventDefault(); }}
                onDrop={(event) => {
                  if (!draggedId) return;
                  event.preventDefault();
                  move(items.findIndex(({ id }) => id === draggedId), index);
                  setDraggedId(null);
                }}
              >
                <span
                  draggable={editable && items.length > 1}
                  aria-hidden="true"
                  className="p-1 text-muted-foreground [&[draggable=true]]:cursor-grab"
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", item.id);
                    setDraggedId(item.id);
                  }}
                  onDragEnd={() => setDraggedId(null)}
                >
                  <GripVertical className="size-4" />
                </span>
                <span className="w-6 text-center text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                <span className="min-w-0 flex-1 break-words text-sm font-medium">{item.name}</span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={L(`上移 ${item.name}`, `Move ${item.name} up`)}
                  disabled={!editable || index === 0} onClick={() => move(index, index - 1)}>
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={L(`下移 ${item.name}`, `Move ${item.name} down`)}
                  disabled={!editable || index === items.length - 1} onClick={() => move(index, index + 1)}>
                  <ArrowDown />
                </Button>
              </li>
            ))}
          </ol>
        ) : !order.isError && (
          <p className="text-sm text-muted-foreground">{L("暂无已发布应用。", "No published apps yet.")}</p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>{L("取消", "Cancel")}</Button>
          <Button disabled={!editable || !changed} onClick={() => void save()}>
            {saving ? L("正在保存…", "Saving…") : L("保存顺序", "Save order")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

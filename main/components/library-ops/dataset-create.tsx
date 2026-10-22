"use client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canCreate } from "@/lib/admin/policy";
import { useAdminAccess } from "@/lib/hooks/use-admin-access";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
export function DatasetCreate() {
  const { data: access } = useAdminAccess();
  const en = useLocale() === "en";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [contentAttribute, setType] = useState("oral");
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nickname, contentAttribute }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      return p;
    },
    onSuccess: () => {
      setOpen(false);
      setName("");
      setNickname("");
      client.invalidateQueries({ queryKey: ["admin-categories"] });
      client.invalidateQueries({ queryKey: ["business-access"] });
      toast.success(en ? "Dataset created" : "语料集已创建");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!access || !canCreate(access, "dataset")) return null;
  return (
    <section className="space-y-3">
      <Button variant="outline" onClick={() => setOpen(!open)}>
        {en ? "Create dataset" : "创建语料集"}
      </Button>
      {open && (
        <form
          className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="dataset-slug">
              {en ? "Dataset slug" : "语料集标识"}
            </Label>
            <Input
              id="dataset-slug"
              required
              aria-label={en ? "Dataset slug" : "语料集标识"}
              placeholder={
                en ? "Unique slug" : "唯一标识（字母、数字、连字符）"
              }
              pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dataset-name">
              {en ? "Dataset name" : "语料集名称"}
            </Label>
            <Input
              id="dataset-name"
              required
              maxLength={100}
              aria-label={en ? "Dataset name" : "语料集名称"}
              placeholder={en ? "Display name" : "展示名称"}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dataset-content-class">
              {en ? "Content class" : "语料大类"}
            </Label>
            <Select value={contentAttribute} onValueChange={setType}>
              <SelectTrigger
                id="dataset-content-class"
                className="w-full"
                aria-label={en ? "Content class" : "语料大类"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oral">
                  {en ? "Oral corpus" : "口语语料"}
                </SelectItem>
                <SelectItem value="cultural_knowledge">
                  {en ? "Cultural knowledge" : "文化知识"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="self-end" disabled={create.isPending}>
            {en ? "Create (private by default)" : "创建（默认非公开）"}
          </Button>
        </form>
      )}
    </section>
  );
}

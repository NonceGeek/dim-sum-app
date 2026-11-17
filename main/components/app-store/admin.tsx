"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Eye, Upload, ArrowLeft, Loader2, ListOrdered } from "lucide-react";
import {
  CATEGORIES,
  EMPTY_DRAFT,
  appDraftSchema,
  prepareEntryUrls,
  publishIssues,
  requiredPublicationFields,
  type AppDraft,
  type StoreApp,
} from "@/lib/app-store/model";
import { appJson } from "./favorites";
import { appCopy } from "./copy";
import { AppArtwork } from "./artwork";
import { AppPrivacy } from "./privacy";
import { AppOrderDialog } from "./order";

type SaveAction = "save" | "publish" | "offline";
type FieldErrors = Partial<Record<keyof AppDraft, string>>;

type AdminRow = {
  id: string;
  status: string;
  revision: number;
  draft: AppDraft;
  hasChanges: boolean;
  updatedAt: string;
};
export function AppStoreAdmin() {
  const en = useLocale() === "en";
  const t = appCopy(en ? "en" : "zh-CN");
  const L = (zh: string, english: string) => (en ? english : zh);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-applications"],
    retry: false,
    queryFn: () =>
      fetch("/api/admin/applications", { cache: "no-store" }).then(
        appJson<{ apps: AdminRow[]; writesEnabled: boolean }>,
      ),
  });
  const [editor, setEditor] = useState<{
    id?: string;
    revision: number;
    draft: AppDraft;
    status: string;
  } | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [pending, setPending] = useState<SaveAction | "upload" | null>(null);
  const busy = pending !== null;
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState<
    "publish" | "offline" | "leave" | null
  >(null);
  const confirming = pending !== null && pending === confirm;
  const [dirty, setDirty] = useState(false);
  const [validation, setValidation] = useState<SaveAction | null>(null);
  const errors =
    validation && editor ? draftErrors(editor.draft, validation) : {};
  const required = requiredPublicationFields(editor?.draft.kind ?? "web");
  const optional = L("（可选）", " (optional)");
  const enabled = !!query.data?.writesEnabled;
  const stateLabel = (v: string) =>
    v === "draft"
      ? L("草稿", "Draft")
      : v === "published"
        ? L("已发布", "Published")
        : L("已下线", "Offline");
  const rows = (query.data?.apps ?? []).filter(
    (a) =>
      (status === "all" || a.status === status) &&
      [a.draft.name, a.draft.authors, a.id]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  function change<K extends keyof AppDraft>(key: K, value: AppDraft[K]) {
    setEditor((e) => ({ ...e!, draft: { ...e!.draft, [key]: value } }));
    setDirty(true);
  }
  function draftErrors(draft: AppDraft, action: SaveAction): FieldErrors {
    const fieldErrors: FieldErrors = {};
    if (action === "publish") {
      for (const issue of publishIssues(draft)) {
        if (issue === "https") {
          fieldErrors.launchUrl = L(
            "请输入有效的 HTTPS 链接。",
            "Enter a valid HTTPS URL.",
          );
        } else {
          fieldErrors[issue] = L(
            "发布前请填写此项。",
            "Complete this field before publishing.",
          );
        }
      }
    }

    const parsed = appDraftSchema.safeParse(prepareEntryUrls(draft));
    if (parsed.success) return fieldErrors;
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof AppDraft;
      if (fieldErrors[field]) continue;
      if (issue.code === "too_big" && issue.type === "string") {
        fieldErrors[field] = L(
          `最多可填写 ${issue.maximum} 个字符。`,
          `Enter no more than ${issue.maximum} characters.`,
        );
      } else if (field === "rank") {
        fieldErrors[field] = L(
          "请输入 0 到 999999 之间的整数。",
          "Enter a whole number from 0 to 999999.",
        );
      } else if (field === "privacyUrl") {
        fieldErrors[field] = L(
          "请输入有效的 HTTP(S) 链接，或留空。文字可以填在「隐私说明」。",
          "Enter a valid HTTP(S) URL or leave this blank. Add text under Privacy description.",
        );
      } else if (field === "mobileLaunchUrl" || field === "desktopLaunchUrl") {
        fieldErrors[field] = L(
          "请输入 HTTPS 链接或有效的微信小程序跳转链接。",
          "Enter an HTTPS URL or a valid WeChat mini program link.",
        );
      } else if (field.endsWith("Url")) {
        fieldErrors[field] = L(
          "请输入有效的 HTTP(S) 链接。",
          "Enter a valid HTTP(S) URL.",
        );
      } else {
        fieldErrors[field] = L("请检查此项内容。", "Check this field.");
      }
    }
    return fieldErrors;
  }
  function submit(action: SaveAction) {
    if (!editor || busy) return;
    const fieldErrors = draftErrors(editor.draft, action);
    const first = Object.keys(fieldErrors)[0];
    if (first) {
      setValidation(action);
      requestAnimationFrame(() => document.getElementById(first)?.focus());
      return;
    }
    setValidation(null);
    if (action === "save") void save(action);
    else setConfirm(action);
  }
  async function saveRequest<T>(
    url: string,
    method: "POST" | "PATCH",
    body: unknown,
  ) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409)
      throw new Error(
        L(
          "这条应用已被更新。请先备份当前修改，再刷新页面后重试。",
          "This app has been updated. Copy your edits before refreshing and trying again.",
        ),
      );
    if (res.status === 401 || res.status === 403)
      throw new Error(
        L(
          "请确认已登录且有应用管理权限。",
          "Sign in with an account that can manage applications.",
        ),
      );
    if (!res.ok)
      throw new Error(
        L(
          "应用未提交成功，请检查填写内容或稍后重试。当前填写内容仍在页面上。",
          "The application could not be submitted. Check the form or try again later. Your edits are still here.",
        ),
      );
    return appJson<T>(res);
  }
  async function save(action: SaveAction) {
    if (!editor || busy) return;
    const draft = prepareEntryUrls(editor.draft);
    setPending(action);
    try {
      let id = editor.id;
      let revision = editor.revision;
      if (!id) {
        const r = await saveRequest<{ id: string; revision: number }>(
          "/api/admin/applications",
          "POST",
          draft,
        );
        id = r.id;
        revision = r.revision;
        // Retain the new draft ID even if the subsequent publication fails.
        setEditor((e) => ({ ...e!, id, revision, status: "draft" }));
      }
      const result = await saveRequest<{
        id: string;
        revision: number;
        status: string;
      }>(`/api/admin/applications/${id}`, "PATCH", {
        revision,
        draft,
        action,
      });
      setEditor((e) => ({ ...e!, ...result, draft }));
      setDirty(false);
      setConfirm(null);
      await cache.invalidateQueries({ queryKey: ["admin-applications"] });
      await cache.invalidateQueries({ queryKey: ["app-store"] });
      await cache.invalidateQueries({ queryKey: ["app-favorites"] });
      toast.success(
        action === "publish"
          ? L("已发布", "Published")
          : action === "offline"
            ? L("已下线", "Taken offline")
            : L(
                "草稿已保存，线上版本未改变",
                "Draft saved; public version unchanged",
              ),
      );
    } catch (e) {
      setConfirm(null);
      toast.error(
        e instanceof Error && !(e instanceof TypeError)
          ? e.message
          : L(
              "提交失败，请检查网络连接后重试。当前填写内容仍在页面上。",
              "Could not submit. Check your connection and try again. Your edits are still here.",
            ),
      );
    } finally {
      setPending(null);
    }
  }
  async function upload(
    file: File,
    field: "coverUrl" | "iconUrl" | "qrUrl" | "demoUrl",
  ) {
    if (busy) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error(
        L(
          "请使用 4 MB 以内的文件；较大演示视频请填写 URL。",
          "Use a file under 4 MB, or enter a URL for larger demo videos.",
        ),
      );
      return;
    }
    setPending("upload");
    try {
      const data = new FormData();
      data.set("file", file);
      const r = await appJson<{ url: string }>(
        await fetch("/api/admin/applications/media", {
          method: "POST",
          body: data,
        }),
      );
      change(field, r.url);
      if (field === "demoUrl")
        change("demoType", file.type.startsWith("image/") ? "image" : "video");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.error);
    } finally {
      setPending(null);
    }
  }
  function textField(
    key: keyof AppDraft,
    label: string,
    multiline = false,
    hint?: string,
  ) {
    const isRequired = required.some((field) => field === key);
    const error = errors[key];
    const fieldProps = {
      id: key,
      "aria-required": isRequired || undefined,
      "aria-invalid": !!error || undefined,
      "aria-describedby": error || hint ? `${key}-hint` : undefined,
    };
    return (
      <div
        key={key}
        className={multiline ? "space-y-2 sm:col-span-2" : "space-y-2"}
      >
        <Label htmlFor={key}>
          {label}
          {isRequired ? " *" : optional}
        </Label>
        {multiline ? (
          <Textarea
            {...fieldProps}
            value={String(editor!.draft[key])}
            onChange={(e) => change(key, e.target.value as never)}
            rows={4}
          />
        ) : (
          <Input
            {...fieldProps}
            value={String(editor!.draft[key])}
            onChange={(e) =>
              change(
                key,
                key === "rank"
                  ? (Number(e.target.value) as never)
                  : (e.target.value as never),
              )
            }
            type={key === "rank" ? "number" : "text"}
            min={0}
            max={key === "rank" ? 999999 : undefined}
          />
        )}
        {(error || hint) && (
          <p
            id={`${key}-hint`}
            className={
              error
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  }
  function selectField(
    key: keyof AppDraft,
    label: string,
    items: [string, string][],
  ) {
    return (
      <div className="space-y-2" key={key}>
        <Label htmlFor={key}>
          {label}
          {optional}
        </Label>
        <Select
          value={String(editor!.draft[key]) || "_none"}
          onValueChange={(v) => change(key, (v === "_none" ? "" : v) as never)}
        >
          <SelectTrigger
            id={key}
            className="w-full"
            aria-invalid={!!errors[key] || undefined}
            aria-describedby={errors[key] ? `${key}-hint` : undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map(([value, name]) => (
              <SelectItem value={value || "_none"} key={value}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors[key] && (
          <p id={`${key}-hint`} className="text-sm text-destructive">
            {errors[key]}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {L("应用管理", "Applications")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {L(
              "维护应用资料，预览后发布。草稿与线上版本分开保存。",
              "Edit, preview and publish. Drafts are separate from the public version.",
            )}
          </p>
        </div>
        {!editor && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!enabled} onClick={() => setOrderOpen(true)}>
              <ListOrdered className="size-4" />
              {L("调整推荐顺序", "Adjust recommended order")}
            </Button>
            <Button
              disabled={!enabled}
              onClick={() => {
                setEditor({
                  revision: 0,
                  draft: { ...EMPTY_DRAFT },
                  status: "draft",
                });
                setValidation(null);
                setDirty(false);
              }}
            >
              <Plus className="h-4 w-4" />
              {L("新建应用", "New application")}
            </Button>
          </div>
        )}
      </div>
      {orderOpen && <AppOrderDialog onClose={() => setOrderOpen(false)} />}
      {query.isError && (
        <div role="alert" className="rounded-lg border p-5">
          <p>
            {L(
              "应用管理暂不可用，请检查数据库准备情况或稍后重试。",
              "Application management is unavailable. Check the database rollout or retry.",
            )}
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => query.refetch()}
          >
            {t.retry}
          </Button>
        </div>
      )}
      {query.data && !enabled && (
        <p role="status" className="rounded-lg bg-muted p-4 text-sm">
          {L(
            "写入尚未启用。完成数据库和旧公开接口兼容发布后才能录入、发布和收藏。",
            "Writes are disabled until the schema and legacy API rollout are complete.",
          )}
        </p>
      )}
      {!editor ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className="max-w-md"
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger
                className="w-40"
                aria-label={L("状态筛选", "Filter by status")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["all", "draft", "published", "offline"].map((v) => (
                  <SelectItem value={v} key={v}>
                    {v === "all" ? t.all : stateLabel(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  {[
                    L("应用", "Application"),
                    L("状态", "Status"),
                    L("最近编辑", "Last edited"),
                    L("操作", "Action"),
                  ].map((h) => (
                    <th key={h} className="p-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-4">
                      <b>
                        {row.draft.name ||
                          L("未命名应用", "Untitled application")}
                      </b>
                      <p className="mt-1 text-xs text-muted-foreground">
                        #{row.id} · {row.draft.authors}
                      </p>
                    </td>
                    <td className="p-4">
                      {stateLabel(row.status)}
                      {row.hasChanges && (
                        <p className="mt-1 text-xs text-primary">
                          {L("有未发布编辑", "Unpublished changes")}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      {new Date(row.updatedAt).toLocaleDateString(
                        en ? "en" : "zh-CN",
                      )}
                    </td>
                    <td className="p-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditor({
                            id: row.id,
                            revision: row.revision,
                            draft: { ...EMPTY_DRAFT, ...row.draft },
                            status: row.status,
                          });
                          setValidation(null);
                          setDirty(false);
                        }}
                      >
                        {L("编辑与预览", "Edit & preview")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {query.isPending ? (
              <p className="p-8 text-center">…</p>
            ) : (
              !rows.length &&
              !query.isError && (
                <p className="p-8 text-center text-muted-foreground">
                  {t.empty}
                </p>
              )
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => (dirty ? setConfirm("leave") : setEditor(null))}
            >
              <ArrowLeft className="h-4 w-4" />
              {L("返回列表", "Back to list")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {stateLabel(editor.status)}
              {dirty ? L(" · 未保存", " · Unsaved") : ""}
            </span>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPreview(true)}
            >
              <Eye className="h-4 w-4" />
              {L("预览", "Preview")}
            </Button>
          </div>
          <fieldset
            disabled={busy || !enabled}
            className="space-y-6 disabled:opacity-60"
          >
            <section className="rounded-xl border p-5">
              <h2 className="mb-5 font-semibold">
                {L("基础资料", "App information")}
              </h2>
              <p className="mb-5 text-sm text-muted-foreground">
                {L(
                  "带 * 的字段在发布时必填，保存草稿可以留空。",
                  "Fields marked * are required to publish and may be left blank in a draft.",
                )}
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {textField("name", L("名称", "Name"))}
                {textField("authors", L("作者 / 团队", "Authors / team"))}
                {textField("summary", L("一句话介绍", "Summary"))}
                {selectField(
                  "category",
                  L("分类", "Category"),
                  CATEGORIES.map((v) => [v, t[v]]),
                )}
                {textField("description", L("完整介绍", "Description"), true)}
                {selectField("badge", L("展示标签", "Badge"), [
                  ["", L("无标签", "No badge")],
                  ["featured", t.featured],
                  ["experimental", t.experimental],
                ])}
                {textField(
                  "rank",
                  L("推荐排序", "Editorial order"),
                  false,
                  L(
                    "0 为默认，正数越小越靠前。",
                    "0 is the default. Lower positive numbers appear first.",
                  ),
                )}
              </div>
            </section>
            <section className="rounded-xl border p-5">
              <h2 className="mb-5 font-semibold">
                {L("访问与支持", "Access & support")}
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {selectField("kind", L("入口类型", "Entry type"), [
                  ["web", t.web],
                  ["miniprogram", t.miniprogram],
                  ["resource", t.resource],
                ])}
                {selectField("access", t.accessLabel, [
                  ["unknown", t.unknown],
                  ["direct", t.instant],
                  ["request", t.request],
                ])}
                {editor.draft.kind === "miniprogram" ? (
                  <>
                    {textField(
                      "mobileLaunchUrl",
                      L("手机微信跳转入口", "Mobile WeChat launch URL"),
                    )}
                    {textField(
                      "desktopLaunchUrl",
                      L("桌面微信跳转入口", "Desktop WeChat launch URL"),
                    )}
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                      {L(
                        "发布前请在下方「素材与演示」上传微信二维码。跳转入口可填已验证的 HTTPS 链接或微信小程序 Scheme；留空时打开二维码弹窗。",
                        "Add the WeChat QR code under Artwork & demo before publishing. Use a verified HTTPS link or WeChat mini-program Scheme for direct opening, or leave both links blank to show the QR code.",
                      )}
                    </p>
                  </>
                ) : (
                  textField(
                    "launchUrl",
                    L("启动 / 申请 URL", "Launch / request URL"),
                    false,
                    L("填写 HTTPS 链接。", "Enter an HTTPS URL."),
                  )
                )}
                {textField("homepageUrl", t.homepage)}
                {textField("githubUrl", t.github)}
                {selectField("login", t.loginLabel, [
                  ["unknown", t.unknown],
                  ["none", t.none],
                  ["required", t.required],
                ])}
                {selectField("devices", t.devices, [
                  ["unknown", t.unknown],
                  ["both", t.both],
                  ["desktop", t.desktop],
                  ["mobile", t.mobile],
                ])}
              </div>
            </section>
            <section className="rounded-xl border p-5">
              <h2 className="mb-5 font-semibold">
                {L("素材与演示", "Artwork & demo")}
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {(["coverUrl", "iconUrl", "qrUrl", "demoUrl"] as const).map(
                  (field, i) => (
                    <div key={field} className="space-y-2">
                      {textField(
                        field,
                        [
                          L("封面 URL", "Cover URL"),
                          L("应用图标 URL", "App icon URL"),
                          L("微信二维码 URL", "WeChat QR URL"),
                          L("演示 URL", "Demo URL"),
                        ][i],
                        false,
                        field === "coverUrl"
                          ? L("留空时自动生成。", "Generated when left blank.")
                          : undefined,
                      )}
                      <Label className="inline-flex cursor-pointer items-center gap-2 text-xs text-primary">
                        <Upload className="h-3 w-3" />
                        {L("上传文件", "Upload file")}
                        <input
                          type="file"
                          className="sr-only"
                          accept={
                            field === "demoUrl"
                              ? "image/jpeg,image/png,image/webp,image/gif,video/mp4"
                              : "image/jpeg,image/png,image/webp,image/gif"
                          }
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void upload(f, field);
                            e.target.value = "";
                          }}
                        />
                      </Label>
                    </div>
                  ),
                )}
                {selectField("demoType", L("演示类型", "Demo type"), [
                  ["video", L("视频", "Video")],
                  ["image", L("图片", "Image")],
                ])}
              </div>
            </section>
            <section className="rounded-xl border p-5">
              <h2 className="mb-5 font-semibold">
                {L(
                  "使用与隐私说明（按实际情况填写）",
                  "Usage & privacy (when applicable)",
                )}
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {textField(
                  "privacyDescription",
                  t.privacyDescription,
                  true,
                  L(
                    "可填写文字说明，或贴入 HTTP(S) 链接。",
                    "Enter a written description or paste an HTTP(S) URL.",
                  ),
                )}
                {textField(
                  "privacyUrl",
                  t.privacy,
                  false,
                  L("填写 HTTP(S) 链接。", "Enter an HTTP(S) URL."),
                )}
                {textField("notice", t.notice, true)}
              </div>
            </section>
          </fieldset>
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t bg-background/95 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
            {editor.id && editor.status === "published" && (
              <Button
                variant="destructive"
                disabled={busy || !enabled}
                onClick={() => submit("offline")}
              >
                {L("下线", "Take offline")}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy || !enabled}
              aria-busy={pending === "save"}
              onClick={() => submit("save")}
            >
              {pending === "save" ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                  {L("正在保存…", "Saving…")}
                </>
              ) : (
                L("保存草稿", "Save draft")
              )}
            </Button>
            <Button
              disabled={busy || !enabled}
              onClick={() => submit("publish")}
            >
              {L("立即发布", "Publish now")}
            </Button>
          </div>
          <Dialog open={preview} onOpenChange={setPreview}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{L("未发布预览", "Draft preview")}</DialogTitle>
                <DialogDescription>
                  {L(
                    "预览当前填写内容；不会修改线上版本。",
                    "Preview the current form without changing the public version.",
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-xl border">
                <AppArtwork
                  app={
                    {
                      ...editor.draft,
                      id: editor.id ?? "preview",
                      publishedAt: "",
                      updatedAt: "",
                    } as StoreApp
                  }
                />
                <div className="space-y-4 p-5">
                  <p className="text-xs text-primary">
                    {t[editor.draft.category]} · {t[editor.draft.kind]}
                  </p>
                  <h2 className="text-2xl font-semibold">
                    {editor.draft.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {editor.draft.authors}
                  </p>
                  <p>{editor.draft.summary}</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {editor.draft.description}
                  </p>
                  <div className="rounded-lg bg-muted p-4 text-sm">
                    {t[editor.draft.login]} · {t[editor.draft.devices]}
                    <p className="mt-2 whitespace-pre-wrap">
                      {editor.draft.notice}
                    </p>
                  </div>
                  <AppPrivacy app={editor.draft} copy={t} />
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog
            open={!!confirm}
            onOpenChange={(v) => !v && !busy && setConfirm(null)}
          >
            <DialogContent showCloseButton={!busy}>
              <DialogHeader>
                <DialogTitle>
                  {confirm === "leave"
                    ? L("放弃未保存修改？", "Discard unsaved changes?")
                    : confirm === "offline"
                      ? L("确认下线应用？", "Take this app offline?")
                      : L("确认发布当前内容？", "Publish this version?")}
                </DialogTitle>
                <DialogDescription>
                  {confirm === "offline"
                    ? L(
                        "公开列表和启动入口将隐藏，用户收藏记录保留。",
                        "The app will be hidden publicly; saved favorites are retained.",
                      )
                    : confirm === "publish"
                      ? L(
                          "此操作会更新公开应用资料，请先检查内容与链接。",
                          "This updates the public app. Review its content and links first.",
                        )
                      : L(
                          "未保存的内容会丢失。",
                          "Unsaved edits will be lost.",
                        )}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  {t.cancel}
                </Button>
                <Button
                  disabled={busy}
                  aria-busy={confirming}
                  onClick={() => {
                    if (confirm === "leave") {
                      setEditor(null);
                      setDirty(false);
                      setConfirm(null);
                    } else if (confirm) void save(confirm);
                  }}
                >
                  {confirming ? (
                    <>
                      <Loader2
                        aria-hidden="true"
                        className="animate-spin motion-reduce:animate-none"
                      />
                      {confirm === "publish"
                        ? L("正在发布…", "Publishing…")
                        : L("正在下线…", "Taking offline…")}
                    </>
                  ) : (
                    L("确认", "Confirm")
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

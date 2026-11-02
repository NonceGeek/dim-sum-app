"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Heart,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  SORTS,
  catalog,
  categoryCode,
  type StoreApp,
} from "@/lib/app-store/model";
import { track } from "@/lib/analytics/client";
import { appCopy } from "./copy";
import { AppArtwork } from "./artwork";
import { appJson, useAppFavorites } from "./favorites";

function Overlay({
  open,
  close,
  title,
  children,
}: {
  open: boolean;
  close: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const t = appCopy(useLocale());
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const m = matchMedia("(max-width: 639px)");
    const sync = () => setMobile(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, []);
  return mobile ? (
    <Drawer open={open} onOpenChange={(v) => !v && close()}>
      <DrawerContent className="max-h-[92dvh] pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{title}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto p-5">
          <div className="mb-2 flex justify-end">
            <Button variant="ghost" onClick={close}>
              {t.close}
            </Button>
          </div>
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  ) : (
    <Sheet open={open} onOpenChange={(v) => !v && close()}>
      <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-xl">
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{title}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
export function StoreCatalog() {
  const locale = useLocale();
  const t = appCopy(locale);
  const params = useSearchParams();
  const router = useRouter();
  const query = useQuery({
    queryKey: ["app-store"],
    queryFn: () =>
      fetch("/api/app-store/apps", { cache: "no-store" }).then(
        appJson<{ apps: StoreApp[] }>,
      ),
  });
  const favorites = useAppFavorites();
  const seen = useRef(false);
  const [limit, setLimit] = useState(12);
  const [dialog, setDialog] = useState<{
    kind: "launch" | "qr" | "demo" | "login";
    app?: StoreApp;
  } | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const q = params.get("q") ?? "";
  const rawCat = params.get("category") ?? "";
  const cat = rawCat && rawCat !== "all" ? categoryCode(rawCat) : "";
  const sort = SORTS.includes(params.get("sort") as (typeof SORTS)[number])
    ? params.get("sort")!
    : "recommended";
  const instant = params.get("instant") === "true";
  const apps = query.data?.apps ?? [];
  const visible = useMemo(
    () => catalog(apps, q, cat, instant, sort),
    [apps, q, cat, instant, sort],
  );
  const selected = apps.find((a) => a.id === params.get("app"));
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    Object.entries(values).forEach(([k, v]) =>
      v ? next.set(k, v) : next.delete(k),
    );
    router.replace(`/appStore${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
    setLimit(12);
  }
  useEffect(() => {
    if (!seen.current) {
      seen.current = true;
      track("app_store_action", { action: "view" });
    }
  }, []);
  function detail(app: StoreApp) {
    update({ app: app.id });
    track("app_store_action", { action: "detail", appId: app.id });
  }
  async function save(app: StoreApp) {
    if (favorites.query.isError) {
      toast.error(t.favoriteFailed);
      void favorites.query.refetch();
      return;
    }
    if (!(await favorites.toggle(app.id))) setDialog({ kind: "login" });
    else track("app_store_action", { action: "favorite", appId: app.id });
  }
  function launch(app: StoreApp) {
    track("app_store_action", { action: "launch", appId: app.id });
    if (app.kind === "miniprogram" || (!app.launchUrl && app.qrUrl))
      setDialog({ kind: "qr", app });
    else setDialog({ kind: "launch", app });
  }
  function launchButton(app: StoreApp, className = "") {
    const text =
      !app.launchUrl && !app.qrUrl
        ? t.noLaunch
        : app.kind === "miniprogram"
          ? t.qr
          : app.access === "request"
            ? t.request
            : app.access === "direct"
              ? t.launch
              : t.open;
    return app.launchUrl &&
      app.kind !== "miniprogram" &&
      app.access !== "request" &&
      !app.notice ? (
      <Button asChild className={className}>
        <a
          href={app.launchUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            track("app_store_action", { action: "launch", appId: app.id })
          }
        >
          {text}
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </Button>
    ) : (
      <Button
        className={className}
        disabled={!app.launchUrl && !app.qrUrl}
        onClick={() => launch(app)}
      >
        {text}
        <ArrowUpRight className="h-4 w-4" />
      </Button>
    );
  }
  function star(app: StoreApp) {
    return (
      <Button
        size="icon"
        variant="ghost"
        disabled={
          favorites.pending === app.id ||
          favorites.loadingSession ||
          (favorites.authenticated && favorites.query.isLoading)
        }
        aria-label={favorites.saved.has(app.id) ? t.unsave : t.save}
        aria-pressed={favorites.saved.has(app.id)}
        onClick={() => save(app)}
      >
        <Heart
          className={`h-5 w-5 ${favorites.saved.has(app.id) ? "fill-primary text-primary" : ""}`}
        />
      </Button>
    );
  }
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-8 sm:pt-14">
      <header className="max-w-2xl">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[.16em] text-primary">
          <Sparkles className="h-4 w-4" />
          {t.eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.subtitle}</p>
      </header>
      <form
        className="relative mt-7 max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          track("app_store_action", { action: "search", query: q });
        }}
      >
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
        <Input
          aria-label={t.search}
          placeholder={t.search}
          value={q}
          maxLength={100}
          onChange={(e) => update({ q: e.target.value })}
          className="h-12 rounded-xl pl-12"
        />
      </form>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div
          className="flex max-w-full gap-2 overflow-x-auto pb-1"
          aria-label={t.all}
        >
          {["", ...CATEGORIES].map((c) => (
            <Button
              key={c}
              size="sm"
              variant={cat === c ? "default" : "outline"}
              className="shrink-0 rounded-full"
              aria-pressed={cat === c}
              onClick={() => {
                update({ category: c });
                track("app_store_action", {
                  action: "filter",
                  value: c || "all",
                });
              }}
            >
              {c ? t[c] : t.all}
            </Button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={instant}
            onChange={(e) => {
              update({ instant: e.target.checked ? "true" : "" });
              track("app_store_action", {
                action: "filter",
                value: e.target.checked ? "instant" : "all-access",
              });
            }}
            className="accent-primary"
          />
          {t.instant}
        </label>
      </div>
      <div className="my-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {query.isPending ? "…" : visible.length} {t.results}
        </p>
        <div className="hidden sm:block">
          <Select
            value={sort}
            onValueChange={(v) => {
              update({ sort: v });
              track("app_store_action", { action: "sort", value: v });
            }}
          >
            <SelectTrigger aria-label={t.sort} className="min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((v) => (
                <SelectItem value={v} key={v}>
                  {t[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          className="sm:hidden"
          onClick={() => setSortOpen(true)}
        >
          {t[sort as (typeof SORTS)[number]]}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
      {query.isPending ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : query.isError ? (
        <div role="alert" className="rounded-xl border p-10 text-center">
          <p>{t.error}</p>
          <Button className="mt-4" onClick={() => query.refetch()}>
            {t.retry}
          </Button>
        </div>
      ) : !visible.length ? (
        <div className="py-20 text-center">
          <h2 className="text-xl font-medium">{t.empty}</h2>
          <p className="mt-2 text-muted-foreground">{t.emptyHint}</p>
          <Button
            variant="outline"
            className="mt-5"
            onClick={() =>
              update({ q: "", category: "", instant: "", sort: "" })
            }
          >
            {t.reset}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.slice(0, limit).map((app) => (
              <article
                key={app.id}
                className="flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md"
              >
                <div className="relative">
                  <AppArtwork app={app} />
                  {app.badge && (
                    <span className="absolute left-3 top-3 rounded-full bg-background/95 px-3 py-1 text-xs font-medium">
                      {t[app.badge]}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-primary">
                      {t[app.category]}
                    </span>
                    {star(app)}
                  </div>
                  <h2 className="text-xl font-semibold">
                    <button
                      onClick={() => detail(app)}
                      className="text-left hover:underline"
                    >
                      {app.name}
                    </button>
                  </h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {app.authors}
                  </p>
                  <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                    {app.summary}
                  </p>
                  <div className="my-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-muted px-2 py-1">
                      {t[app.kind]}
                    </span>
                    {app.login !== "unknown" && (
                      <span className="rounded-md bg-muted px-2 py-1">
                        {t[app.login]}
                      </span>
                    )}
                    {app.access === "direct" && (
                      <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">
                        {t.instant}
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Button
                      variant="outline"
                      className="h-10 flex-1"
                      onClick={() => detail(app)}
                    >
                      {t.detail}
                    </Button>
                    {launchButton(app, "h-10 flex-1")}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {visible.length > limit && (
            <div className="mt-8 text-center">
              <Button variant="outline" onClick={() => setLimit((n) => n + 12)}>
                {t.more}
              </Button>
            </div>
          )}
        </>
      )}
      <Overlay
        open={!!selected}
        close={() => update({ app: "" })}
        title={selected?.name ?? t.detail}
      >
        {selected && (
          <div className="space-y-6 pt-5">
            <AppArtwork app={selected} className="rounded-xl" />
            <div>
              <p className="mb-2 text-sm text-primary">
                {t[selected.category]} · {t[selected.kind]}
              </p>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold">{selected.name}</h2>
                {star(selected)}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {selected.authors}
              </p>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {selected.description || selected.summary}
            </p>
            <section className="rounded-xl bg-muted p-4">
              <h3 className="mb-3 font-semibold">{t.before}</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {[
                  [
                    t.accessLabel,
                    selected.access === "direct"
                      ? t.instant
                      : selected.access === "request"
                        ? t.request
                        : t.unknown,
                  ],
                  [t.loginLabel, t[selected.login]],
                  [t.devices, t[selected.devices]],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-1">{v}</dd>
                  </div>
                ))}
              </dl>
              {selected.notice && (
                <p className="mt-4 whitespace-pre-wrap border-t pt-3 text-sm">
                  {selected.notice}
                </p>
              )}
            </section>
            <div className="flex flex-wrap gap-4 text-sm">
              {[
                [selected.homepageUrl, t.homepage],
                [selected.githubUrl, t.github],
                [selected.privacyUrl, t.privacy],
              ]
                .filter(([u]) => u)
                .map(([u, label]) => (
                  <a
                    key={u}
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    {label} ↗
                  </a>
                ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {launchButton(selected, "min-h-11 flex-1")}
              {selected.qrUrl && selected.kind !== "miniprogram" && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setDialog({ kind: "qr", app: selected })}
                >
                  {t.qr}
                </Button>
              )}
              {selected.demoUrl && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setDialog({ kind: "demo", app: selected });
                    track("app_store_action", {
                      action: "demo",
                      appId: selected.id,
                    });
                  }}
                >
                  <Video className="h-4 w-4" />
                  {t.demo}
                </Button>
              )}
            </div>
            <section className="border-t pt-5">
              <h3 className="font-semibold">{t.related}</h3>
              <div className="mt-3 space-y-2">
                {apps
                  .filter(
                    (a) =>
                      a.category === selected.category && a.id !== selected.id,
                  )
                  .slice(0, 3)
                  .map((a) => (
                    <button
                      key={a.id}
                      className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm hover:bg-accent"
                      onClick={() => detail(a)}
                    >
                      {a.name}
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  ))}
              </div>
            </section>
          </div>
        )}
      </Overlay>
      <Drawer open={sortOpen} onOpenChange={setSortOpen}>
        <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader>
            <DrawerTitle>{t.sort}</DrawerTitle>
            <DrawerDescription className="sr-only">{t.sort}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-2 px-4">
            {SORTS.map((v) => (
              <Button
                key={v}
                variant={v === sort ? "secondary" : "ghost"}
                className="h-12 w-full justify-between"
                onClick={() => {
                  update({ sort: v });
                  setSortOpen(false);
                  track("app_store_action", { action: "sort", value: v });
                }}
              >
                {t[v]}
                {v === sort && <Check className="h-4 w-4" />}
              </Button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === "login" ? t.save : dialog?.app?.name}
            </DialogTitle>
            <DialogDescription>
              {dialog?.kind === "login"
                ? t.loginFirst
                : dialog?.kind === "qr"
                  ? t.qrHint
                  : dialog?.kind === "demo"
                    ? t.demo
                    : t.leavingHint}
            </DialogDescription>
          </DialogHeader>
          {dialog?.kind === "login" && (
            <Button asChild>
              <Link href="/account/my-record">{t.loginAction}</Link>
            </Button>
          )}
          {dialog?.kind === "qr" && dialog.app?.qrUrl && (
            <img
              src={dialog.app.qrUrl}
              alt={t.qr}
              className="mx-auto h-64 w-64 object-contain"
            />
          )}
          {dialog?.kind === "demo" &&
            dialog.app &&
            (dialog.app.demoType === "image" ? (
              <img
                src={dialog.app.demoUrl}
                alt={dialog.app.name}
                className="max-h-[60dvh] w-full object-contain"
              />
            ) : (
              <video
                src={dialog.app.demoUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-lg"
              />
            ))}
          {dialog?.kind === "launch" && dialog.app && (
            <>
              <p className="text-sm">
                {dialog.app.access === "request" ? t.request : t.open} ·{" "}
                {t[dialog.app.login]}
              </p>
              {dialog.app.notice && (
                <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                  {dialog.app.notice}
                </p>
              )}
              <p className="break-all text-xs text-muted-foreground">
                {dialog.app.launchUrl}
              </p>
              <Button asChild>
                <a
                  href={dialog.app.launchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDialog(null)}
                >
                  {t.continue}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

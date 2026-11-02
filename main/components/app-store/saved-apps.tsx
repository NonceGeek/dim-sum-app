"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, ArrowUpRight } from "lucide-react";
import { useAppFavorites } from "./favorites";
import { appCopy } from "./copy";
import { AppArtwork } from "./artwork";
export function SavedApps() {
  const t = appCopy(useLocale());
  const f = useAppFavorites();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(12);
  if (f.loadingSession || f.query.isPending)
    return (
      <p className="py-12 text-center" role="status">
        …
      </p>
    );
  if (f.query.isError)
    return (
      <div role="alert" className="py-12 text-center">
        <p>{t.favoriteFailed}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => f.query.refetch()}
        >
          {t.retry}
        </Button>
      </div>
    );
  const rows = (f.query.data?.favorites ?? []).filter(
    (v) =>
      !q ||
      [v.app?.name, v.app?.authors, v.app?.summary]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <section className="space-y-5">
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setLimit(12);
        }}
        placeholder={t.search}
        aria-label={t.search}
        maxLength={100}
        className="mx-auto max-w-xl"
      />
      {!rows.length ? (
        <div className="py-12 text-center">
          <p>{q ? t.empty : t.noFavorites}</p>
          <Button asChild className="mt-4">
            <Link href="/appStore">{t.browse}</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.slice(0, limit).map((v) => (
              <article
                key={v.id}
                className="overflow-hidden rounded-xl border bg-card"
              >
                {v.app && <AppArtwork app={v.app} />}
                <div className="space-y-3 p-4">
                  <h3 className="text-lg font-semibold">
                    {v.app?.name ?? t.unavailableName}
                  </h3>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {v.app?.summary ?? t.unavailableHint}
                  </p>
                  <div className="flex items-center gap-2">
                    {v.app ? (
                      <Button asChild className="flex-1" variant="outline">
                        <Link href={`/appStore?app=${v.id}`}>
                          {t.detail}
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <span className="flex-1 text-xs text-muted-foreground">
                        {t.unavailable}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      aria-label={t.unsave}
                      disabled={f.pending === v.id}
                      onClick={() => f.toggle(v.id, true)}
                    >
                      <Heart className="h-4 w-4 fill-primary text-primary" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {rows.length > limit && (
            <Button variant="outline" onClick={() => setLimit((n) => n + 12)}>
              {t.more}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

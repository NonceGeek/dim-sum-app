"use client";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function SubmissionAuditPage() {
  const { data: session } = useSession();
  const t = useTranslations("CollectionPermissions");
  const [uid, setUid] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, isFetching } = useQuery({
    queryKey: ["submission-audit", session?.user?.id, uid, page],
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/corpus-collection/submission-audit?page=${page}&userId=${encodeURIComponent(uid)}`,
      );
      if (!res.ok) throw new Error(t("error"));
      return res.json();
    },
  });
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t("audit")}</h2>
      <Input
        aria-label={t("operatorUid")}
        placeholder={t("operatorUid")}
        value={uid}
        onChange={(e) => {
          setUid(e.target.value);
          setPage(1);
        }}
      />
      {error && <p role="alert">{error.message}</p>}
      {data?.items.map((item: any) => (
        <details key={item.id} className="rounded border p-3">
          <summary className="cursor-pointer break-all">
            {item.created_at} · {item.action} · {item.operator_id} ·{" "}
            {item.outcome}
          </summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(item, null, 2)}
          </pre>
        </details>
      ))}
      <div className="flex items-center gap-3">
        <Button
          disabled={page === 1 || isFetching}
          onClick={() => setPage(page - 1)}
        >
          {t("previous")}
        </Button>
        <span>
          {page} / {Math.max(1, Math.ceil((data?.total ?? 0) / 30))}
        </span>
        <Button
          disabled={isFetching || page * 30 >= (data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          {t("next")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { ContributionForm } from "@/components/library/contribution-form";

/** Mobile full-screen contribution flow; desktop uses the Library side sheet. */
export default function ContributePage() {
  const t = useTranslations("Library");
  const router = useRouter();
  const [done, setDone] = useState(false);
  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-2xl flex-col sm:my-6 sm:h-auto sm:rounded-xl sm:border">
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <Link href="/library" aria-label={t("detail.back")}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold">
          {t(done ? "contribute.submittedTitle" : "contribute.title")}
        </h1>
      </div>
      <ContributionForm
        onClose={() => router.push("/library")}
        onSubmittedChange={setDone}
        className="min-h-0 flex-1"
      />
    </div>
  );
}

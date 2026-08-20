"use client";

import { useTranslations } from "next-intl";

export default function AdminSettingsPage() {
  const t = useTranslations("AdminSettings");
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="text-muted-foreground mt-2">
          {t("description")}
        </p>
      </div>

      {/* Content placeholder */}
      <div className="flex items-center justify-center h-96 bg-card border-border border rounded-lg">
        <div className="text-center">
          <h3 className="text-xl font-medium text-muted-foreground mb-2">
            {t("placeholder")}
          </h3>
        </div>
      </div>
    </div>
  );
}
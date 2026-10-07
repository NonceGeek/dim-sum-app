"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Mail, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicDataset } from "@/lib/library/public-datasets";
import { ShareCardDialog } from "@/components/library/share-card-dialog";
import { ContactRequestDialog } from "@/components/library/contact-request-dialog";

export function DatasetActions({ dataset }: { dataset: PublicDataset }) {
  const t = useTranslations("Library.detail");
  const [share, setShare] = useState(false);
  const [contact, setContact] = useState(false);
  const requestType = dataset.accessMode === "request_access" ? "access_request" : "contact";
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Button onClick={() => setShare(true)}>
        <Share2 /> {t("share")}
      </Button>
      {dataset.accessMode !== "external" && (
        <Button variant="outline" onClick={() => setContact(true)}>
          <Mail /> {requestType === "access_request" ? t("requestAccess") : t("contact")}
        </Button>
      )}
      {dataset.sourceUrl && (
        <Button asChild variant="outline">
          <a href={dataset.sourceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            {dataset.accessMode === "external" ? t("viewExternal") : t("viewOriginal")}
          </a>
        </Button>
      )}
      <ShareCardDialog dataset={share ? dataset : null} onOpenChange={setShare} />
      <ContactRequestDialog
        slug={dataset.slug}
        requestType={requestType}
        open={contact}
        onOpenChange={setContact}
      />
    </div>
  );
}

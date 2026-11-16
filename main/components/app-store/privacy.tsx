import { safeUrl, type AppDraft } from "@/lib/app-store/model";
import type { appCopy } from "./copy";

type AppPrivacyProps = {
  app: Pick<AppDraft, "privacyDescription" | "privacyUrl">;
  copy: Pick<ReturnType<typeof appCopy>, "privacyDescription" | "privacy">;
};

export function AppPrivacy({ app, copy }: AppPrivacyProps) {
  const description = app.privacyDescription?.trim();
  const descriptionUrl = safeUrl(description);
  const policyUrl = safeUrl(app.privacyUrl);
  if (!description && !policyUrl) return null;

  return (
    <section className="space-y-2 text-sm">
      {description && (
        <div className="space-y-1">
          <h3 className="font-medium">{copy.privacyDescription}</h3>
          {descriptionUrl ? (
            <a
              href={descriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-primary underline underline-offset-4"
            >
              {description}
            </a>
          ) : (
            <p className="whitespace-pre-wrap break-words text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      {policyUrl && (
        <a
          href={policyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4"
        >
          {copy.privacy} ↗
        </a>
      )}
    </section>
  );
}

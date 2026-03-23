import { BarChart3, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

export function MinimalFooter() {
  const t = useTranslations("Home");

  return (
    <footer className="mt-auto px-6 py-4 flex justify-between items-center">
      <p className="text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} DimSum AI Labs
      </p>
      <div className="flex items-center gap-4">
        <a
          href="https://www.aidimsum.com/zh#stats"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>{t("viewDataStats")}</span>
          <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
        <p className="text-xs text-muted-foreground">
          苏ICP备2025170597号
        </p>
      </div>
    </footer>
  );
}

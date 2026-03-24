"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type SearchResult } from "@/lib/api/search";
import { type DictionaryNote } from "@/lib/types";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CirclePlay, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { corpusInteractApi } from "@/lib/api/corpus-interact";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ReactPlayer from "react-player";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isImageUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  const exts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
  const lower = url.toLowerCase();
  return exts.some((e) => lower.endsWith(e));
}

function isAudioByExt(url: unknown): boolean {
  if (typeof url !== "string") return false;
  return /\.(mp3|wav|ogg|aac|flac|m4a|opus)(\?.*)?$/i.test(url);
}

// The SearchResult note type is always an object (never string/array at the TS
// level), but runtime data may differ. We treat it as `unknown` inside helpers
// to stay safe while keeping type narrowing correct at call sites.

function isDictionaryNote(note: SearchResult["note"]): note is DictionaryNote {
  const n = note as unknown;
  return (
    typeof n === "object" &&
    n !== null &&
    !Array.isArray(n) &&
    "context" in (n as object)
  );
}

function getSnippet(note: SearchResult["note"]): string | null {
  const n = note as unknown;
  if (n === null || n === undefined) return null;

  if (typeof n === "string") {
    if (!isImageUrl(n) && !isAudioByExt(n)) return n as string;
    return null;
  }

  if (Array.isArray(n)) {
    const text = (n as unknown[])
      .filter(
        (i) => typeof i === "string" && !isImageUrl(i) && !isAudioByExt(i)
      )
      .join(" ");
    return text || null;
  }

  if (typeof n === "object" && "context" in (n as object)) {
    const ctx = (n as { context: Record<string, unknown> }).context;
    if (typeof ctx.meaning === "string") return ctx.meaning;
    if (Array.isArray(ctx.meaning))
      return (ctx.meaning as string[]).join("、");
    if (typeof ctx.introduction === "string") return ctx.introduction;
    if (typeof ctx.subtitle === "string") return ctx.subtitle;
    const first = Object.values(ctx).find(
      (v) =>
        typeof v === "string" && !isImageUrl(v) && !isAudioByExt(v)
    );
    return (first as string) ?? null;
  }

  return null;
}

function hasRichContent(note: SearchResult["note"]): boolean {
  const n = note as unknown;
  if (n === null || n === undefined) return false;
  if (typeof n === "string") return true;
  if (Array.isArray(n) && (n as unknown[]).length > 0) return true;
  if (typeof n === "object" && "context" in (n as object)) return true;
  return false;
}

// ─── Edit permission ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useCanEdit(result: SearchResult, user: any): boolean {
  if (!user) return false;
  if (result.editable_level === 0) return false;
  if (result.editable_level === 1) {
    return (
      user.role === "TAGGER_PARTNER" || user.role === "TAGGER_OUTSOURCING"
    );
  }
  return true;
}

// ─── Related links ────────────────────────────────────────────────────────────

function RelatedLinks({
  title,
  links,
  uniqueId,
}: {
  title: string;
  links: { name: string; url: string; description?: string }[];
  uniqueId: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{title}:</span>
      {links.map((link) => (
        <TooltipProvider key={link.name}>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={link.url.replace("{item.unique_id}", uniqueId)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                {link.name}
              </a>
            </TooltipTrigger>
            {link.description && (
              <TooltipContent>
                <p>{link.description}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

// ─── Expanded note content ────────────────────────────────────────────────────

function NoteContent({ result }: { result: SearchResult }) {
  const t = useTranslations("Search");
  // Cast to unknown so we can handle all real-world shapes safely
  const n = result.note as unknown;

  if (n === null || n === undefined) return null;

  if (result.category === "广州话正音字典" && isDictionaryNote(result.note)) {
    const note = result.note as DictionaryNote;
    return (
      <div className="space-y-2 text-sm">
        {note.context.meaning && (
          <p>
            <b className="text-primary">{t("meaning")}：</b>
            {Array.isArray(note.context.meaning)
              ? note.context.meaning.join("、")
              : note.context.meaning}
          </p>
        )}
        {note.context.pinyin && (
          <p>
            <b className="text-primary">{t("pinyin")}：</b>
            {Array.isArray(note.context.pinyin)
              ? note.context.pinyin.join("、")
              : note.context.pinyin}
          </p>
        )}
        {note.contributor && (
          <p>
            <b className="text-primary">{t("contributor")}：</b>
            {note.contributor}
          </p>
        )}
        {note.context.page && (
          <p>
            <b className="text-primary">{t("pageNumber")}：</b>
            {note.context.page}
          </p>
        )}
        {note.context.number && (
          <p>
            <b className="text-primary">{t("number")}：</b>
            {note.context.number}
          </p>
        )}
      </div>
    );
  }

  if (typeof n === "string") {
    if (isImageUrl(n)) {
      return (
        <img
          src={n as string}
          alt="Note image"
          className="max-w-full h-auto rounded-lg"
          loading="lazy"
        />
      );
    }
    return <p className="text-sm leading-relaxed">{n as string}</p>;
  }

  if (Array.isArray(n)) {
    return (
      <div className="space-y-2">
        {(n as unknown[]).map((item, idx) =>
          typeof item === "string" && isImageUrl(item) ? (
            <img
              key={idx}
              src={item}
              alt={`Note image ${idx + 1}`}
              className="max-w-full h-auto rounded-lg"
              loading="lazy"
            />
          ) : (
            <p key={idx} className="text-sm leading-relaxed">
              {String(item)}
            </p>
          )
        )}
      </div>
    );
  }

  if (typeof n === "object" && "context" in (n as object)) {
    const ctx = (n as { context: Record<string, unknown> }).context;

    if (ctx.video && typeof ctx.video === "string") {
      return (
        <div className="space-y-3">
          <div className="relative pt-[56.25%] rounded-lg overflow-hidden">
            <ReactPlayer
              url={ctx.video}
              playing={false}
              controls
              width="100%"
              height="100%"
              className="absolute top-0 left-0"
              config={{
                file: {
                  attributes: {
                    controlsList: "nodownload",
                    disablePictureInPicture: true,
                  },
                },
              }}
            />
          </div>
          {ctx.subtitle && (
            <p className="text-sm leading-relaxed">
              <b className="text-primary">{t("subtitles")}:</b>{" "}
              {ctx.subtitle as string}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2 text-sm">
        {Object.entries(ctx)
          .filter(([key]) => key !== "video" && key !== "subtitle")
          .map(([key, value]) => {
            if (!value) return null;
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            if (Array.isArray(value)) {
              return (
                <p key={key}>
                  <b className="text-primary">{label}:</b>{" "}
                  {(value as string[]).join(", ")}
                </p>
              );
            }
            if (typeof value === "string") {
              if (isAudioByExt(value)) {
                return (
                  <div key={key} className="space-y-1">
                    <b className="text-primary">{label}:</b>
                    <ReactPlayer
                      url={value}
                      playing={false}
                      controls
                      height="100px"
                      width="100%"
                      config={{
                        file: {
                          attributes: {
                            controlsList: "nodownload",
                            disablePictureInPicture: true,
                          },
                        },
                      }}
                    />
                  </div>
                );
              }
              if (isImageUrl(value)) {
                return (
                  <div key={key}>
                    <b className="text-primary">{label}:</b>
                    <img
                      src={value}
                      alt={label}
                      className="max-w-full h-auto rounded-lg mt-1"
                      loading="lazy"
                    />
                  </div>
                );
              }
              if (key === "link" || key === "链接") {
                return (
                  <p key={key}>
                    <b className="text-primary">{label}:</b>{" "}
                    <a
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-primary"
                    >
                      {value}
                    </a>
                  </p>
                );
              }
              if (value.startsWith("http") && !isAudioByExt(value)) {
                return (
                  <div key={key}>
                    <b className="text-primary">{label}:</b>
                    <iframe
                      src={value}
                      title={label}
                      className="w-full h-64 rounded border mt-1"
                      allowFullScreen
                    />
                  </div>
                );
              }
              return (
                <p key={key}>
                  <b className="text-primary">{label}:</b>{" "}
                  <span className="whitespace-pre-line">{value}</span>
                </p>
              );
            }
            return null;
          })}
      </div>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SearchResultItem({
  result,
  setEditingResult,
  setUpdateDialogOpen,
}: {
  result: SearchResult;
  setEditingResult: React.Dispatch<React.SetStateAction<SearchResult | null>>;
  setUpdateDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuthStore();
  const canEdit = useCanEdit(result, user);
  const t = useTranslations("Search");
  const router = useRouter();

  const { data: categoryData } = useQuery({
    queryKey: ["corpusCategory", result.category_name],
    queryFn: () =>
      fetch(
        process.env.NEXT_PUBLIC_BACKEND_URL +
          `/v2/corpus_category?name=${result.category_name}`
      ).then((res) => res.json()),
    staleTime: 60 * 1000,
  });

  const related = categoryData?.related ?? null;
  const snippet = getSnippet(result.note);
  const richContent = hasRichContent(result.note);

  // YueSong variant
  if (result.category === "粤语曲库") {
    const songNote = result.note as {
      context: {
        song_name?: string;
        author?: string;
        album?: string;
        introduction?: string;
      };
    };
    return (
      <div className="py-5 border-b border-border last:border-0">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-primary leading-snug">
              {songNote.context.song_name}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {songNote.context.author}
              {songNote.context.album && ` · ${songNote.context.album}`}
            </p>
            {songNote.context.introduction && (
              <p className="text-sm text-foreground mt-1.5 line-clamp-2">
                {songNote.context.introduction}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
                {result.category}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-primary">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Play"
              onClick={() => {
                corpusInteractApi.updateView(result.unique_id);
                router.push(`/yueSong?id=${result.unique_id}`);
              }}
            >
              <CirclePlay className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`https://card.app.aidimsum.com/?uuid=${result.unique_id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share"
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.preventDefault();
                  navigator.clipboard
                    .writeText(e.currentTarget.href)
                    .then(() => toast("Link copied."));
                }}
              >
                <Share2 className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // WordLyric / default variant
  return (
    <div className="py-5 border-b border-border last:border-0">
      <div className="flex justify-between items-start gap-4">
        <h3 className="text-lg font-semibold text-primary leading-snug flex-1 min-w-0">
          {result.data}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {richContent && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  {t("collapseContent")}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  {t("expandContent")}
                </>
              )}
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingResult(result);
                setUpdateDialogOpen(true);
              }}
            >
              编辑
            </Button>
          )}
        </div>
      </div>

      {!expanded && snippet && (
        <p className="text-sm text-foreground mt-1.5 line-clamp-3 leading-relaxed">
          {snippet}
        </p>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 bg-muted/40 rounded-md p-4 space-y-3">
              <NoteContent result={result} />
              {related && (
                <div className="space-y-2 pt-1 border-t border-border">
                  {related?.apps?.length > 0 && (
                    <RelatedLinks
                      title={t("relatedApps")}
                      links={related.apps}
                      uniqueId={result.unique_id}
                    />
                  )}
                  {related?.links?.length > 0 && (
                    <RelatedLinks
                      title={t("relatedLinks")}
                      links={related.links}
                      uniqueId={result.unique_id}
                    />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
          {result.category}
        </span>
        {result.tags.map((tag, idx) => (
          <span
            key={idx}
            className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded border border-border"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

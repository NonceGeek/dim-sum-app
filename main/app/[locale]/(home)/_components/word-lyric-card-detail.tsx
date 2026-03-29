import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type SearchResult } from "@/lib/api/search";
import ReactPlayer from "react-player";
import { DictionaryNote } from "@/lib/types";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Helper function to check if a string is an image URL
function isImageUrl(url: string): boolean {
  if (typeof url !== "string") return false;
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".svg",
  ];
  const lowerUrl = url.toLowerCase();
  return (
    imageExtensions.some((ext) => lowerUrl.endsWith(ext)) ||
    lowerUrl.includes("image")
  );
}

// Check if result can be edited based on user role and category editable level
function useCanEditResult(result: SearchResult, user: any) {
  // 直接使用搜索结果中的 editable_level，无需额外查询
  const editableLevel = result.editable_level;

  // 如果没有用户，返回不可编辑
  if (!user) return { canEdit: false, isLoading: false };

  // editable_level = 0: 不可编辑
  if (editableLevel === 0) return { canEdit: false, isLoading: false };

  // editable_level = 1: 只有 TAGGER_PARTNER 和 TAGGER_OUTSOURCING 可以编辑
  if (editableLevel === 1) {
    const canEdit =
      user.role === "TAGGER_PARTNER" || user.role === "TAGGER_OUTSOURCING";
    return { canEdit, isLoading: false };
  }

  // editable_level = 2: 所有登录用户都可以编辑
  return { canEdit: true, isLoading: false };
}

// Component to get edit permission for a result
function EditPermissionChecker({
  result,
  user,
  children,
}: {
  result: SearchResult;
  user: any;
  children: (canEdit: boolean, isLoading: boolean) => React.ReactNode;
}) {
  const { canEdit, isLoading } = useCanEditResult(result, user);
  return <>{children(canEdit, isLoading)}</>;
}

function isAudioByExt(url) {
  return /\.(mp3|wav|ogg|aac|flac|m4a|opus)(\?.*)?$/i.test(url);
}

function DisplayRelatedAppsorLinks({
  title,
  related,
  data,
}: {
  title: string;
  related: { name: string; url: string, description?: string }[];
  data: SearchResult;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{title}:&nbsp;&nbsp;&nbsp;</span>
      {related.map((link) => (
        <TooltipProvider key={link.name}>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={link.url.replace("{item.unique_id}", data.unique_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-primary/10 rounded-full text-xs font-medium border border-primary/20"
              >
                {link.name}
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <p>{link.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

export default function WordLyricCardDetail({
  result,
  setEditingResult,
  setUpdateDialogOpen,
  isDictionaryNote,
}: {
  result: SearchResult;
  setEditingResult: React.Dispatch<React.SetStateAction<SearchResult | null>>;
  setUpdateDialogOpen: React.Dispatch<React.SetStateAction<Boolean>>;
  isDictionaryNote: (note: SearchResult["note"]) => note is DictionaryNote;
}) {
  const { user } = useAuthStore();
  const t = useTranslations("Search");
  const tc = useTranslations("Common");

  const { data, isLoading } = useQuery({
    queryKey: ["corpusCatrgory", result.category_name],
    queryFn: () =>
      fetch(
        process.env.NEXT_PUBLIC_BACKEND_URL +
          `/v2/corpus_category?name=${result.category_name}`
      ).then((res) => res.json()),
    staleTime: 60 * 1000,
  });

  const related = data?.related || null;

  return (
    <Card className="p-6 shadow-md hover:bg-accent transition-colors duration-200 mb-4">
      <div className="space-y-6">
        <div className="prose dark:prose-invert max-w-none relative">
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              {result.data}
            </h3>
            <EditPermissionChecker result={result} user={user}>
              {(canEdit, isLoading) =>
                !isLoading &&
                canEdit && (
                  <Button
                    onClick={() => {
                      setEditingResult(result);
                      setUpdateDialogOpen(true);
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-6"
                  >
                    {tc("update")}
                  </Button>
                )
              }
            </EditPermissionChecker>
          </div>
        </div>
        <div className="mt-2 text-sm text-muted-foreground space-y-4">
          {/* Display note content */}
          {result.note && (
            <div className="space-y-2">
              {result.category === "广州话正音字典" ? (
                // Detailed display for zyzd category
                <>
                  {/* <p>isDictionaryNote check result: {String(isDictionaryNote(result.note))}</p>
                                  <pre className="whitespace-pre-wrap bg-gray-50 p-2 rounded">
                                    {JSON.stringify(result.note, null, 2)}
                                  </pre> */}
                  {isDictionaryNote(result.note) && (
                    <div className="bg-muted/50 p-4 rounded-lg border border-border space-y-2">
                      {result.note.context.meaning && (
                        <p className="leading-relaxed">
                          <b className="text-primary">{t("meaning")}：</b>{" "}
                          {Array.isArray(result.note.context.meaning)
                            ? result.note.context.meaning.join("、 ")
                            : result.note.context.meaning}
                        </p>
                      )}
                      {result.note.context.pinyin && (
                        <p className="leading-relaxed">
                          <b className="text-primary">{t("pinyin")}：</b>{" "}
                          {Array.isArray(result.note.context.pinyin)
                            ? result.note.context.pinyin.join("、 ")
                            : result.note.context.pinyin}
                        </p>
                      )}
                      {result.note.contributor && (
                        <p className="leading-relaxed">
                          <b className="text-primary">{t("contributor")}：</b>{" "}
                          {result.note.contributor}
                        </p>
                      )}
                      {result.note.context.page && (
                        <p className="leading-relaxed">
                          <b className="text-primary">{t("pageNumber")}：</b>{" "}
                          {result.note.context.page}
                        </p>
                      )}
                      {result.note.context.number && (
                        <p className="leading-relaxed">
                          <b className="text-primary">{t("number")}：</b>{" "}
                          {result.note.context.number}
                        </p>
                      )}
                      {result.note.context.others && (
                        <p className="leading-relaxed">
                          <b className="text-primary">{t("others")}：</b>{" "}
                          {JSON.stringify(result.note.context.others)}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                // Simple display for other categories
                <div>
                  {/* Handle simple string note that is an image URL */}
                  {typeof result.note === "string" &&
                  isImageUrl(result.note) ? (
                    <div className="bg-muted/50 p-4 rounded-lg border border-border">
                      <img
                        src={result.note}
                        alt="Note image"
                        className="max-w-full h-auto rounded-lg shadow-md"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fallback = document.createElement("p");
                          fallback.textContent = `Image failed to load: ${result.note}`;
                          fallback.className = "text-muted-foreground italic";
                          e.currentTarget.parentNode?.appendChild(fallback);
                        }}
                      />
                    </div>
                  ) : typeof result.note === "string" ? (
                    <div className="bg-muted/50 p-4 rounded-lg border border-border">
                      <p className="leading-relaxed">{result.note}</p>
                    </div>
                  ) : Array.isArray(result.note) ? (
                    <div className="bg-muted/50 p-4 rounded-lg border border-border space-y-2">
                      {result.note.map((item, idx) => (
                        <div key={idx}>
                          {typeof item === "string" && isImageUrl(item) ? (
                            <img
                              src={item}
                              alt={`Note image ${idx + 1}`}
                              className="max-w-full h-auto rounded-lg shadow-md"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const fallback = document.createElement("p");
                                fallback.textContent = `Image failed to load: ${item}`;
                                fallback.className = "text-muted-foreground italic";
                                e.currentTarget.parentNode?.appendChild(
                                  fallback
                                );
                              }}
                            />
                          ) : (
                            <p className="leading-relaxed">{String(item)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    typeof result.note === "object" &&
                    !Array.isArray(result.note) &&
                    !("meaning" in result.note) &&
                    "context" in result.note && (
                      <div className="space-y-4">
                        {(
                          result.note as {
                            context: {
                              video?: string;
                              subtitle?: string;
                            };
                          }
                        ).context.video ? (
                          <div className="space-y-4">
                            <div className="relative pt-[56.25%] rounded-lg overflow-hidden shadow-md">
                              <ReactPlayer
                                url={
                                  (
                                    result.note as {
                                      context: {
                                        video: string;
                                      };
                                    }
                                  ).context.video
                                }
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
                            <div className="bg-muted/50 p-4 rounded-lg border border-border">
                              <p className="whitespace-pre-line leading-relaxed">
                                <b className="text-primary">{t("subtitles")}:</b>{" "}
                                {
                                  (
                                    result.note as {
                                      context: {
                                        subtitle: string;
                                      };
                                    }
                                  ).context.subtitle
                                }
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-muted/50 p-4 rounded-lg border border-border space-y-2">
                            {Object.entries(
                              (
                                result.note as {
                                  context: Record<string, unknown>;
                                }
                              ).context
                            )
                              .filter(
                                ([key]) => key !== "video" && key !== "subtitle"
                              )
                              .map(
                                ([key, value]) =>
                                  value &&
                                  (Array.isArray(value) ||
                                  (typeof value === "string" &&
                                    !isAudioByExt(value)) ? (
                                    <p className="leading-relaxed" key={key}>
                                      <b className="text-primary">
                                        {key.charAt(0).toUpperCase() +
                                          key.slice(1)}
                                        :
                                      </b>{" "}
                                      {Array.isArray(value) ? (
                                        value.join(", ")
                                      ) : typeof value === "string" &&
                                        isImageUrl(value) ? (
                                        <img
                                          src={value}
                                          alt={`${key} image`}
                                          className="max-w-full h-auto rounded-lg shadow-md mt-2"
                                          loading="lazy"
                                          onError={(e) => {
                                            e.currentTarget.style.display =
                                              "none";
                                            const fallback =
                                              document.createElement("p");
                                            fallback.textContent = `Image failed to load: ${value}`;
                                            fallback.className =
                                              "text-muted-foreground italic";
                                            e.currentTarget.parentNode?.appendChild(
                                              fallback
                                            );
                                          }}
                                        />
                                      ) : typeof value === "string" &&
                                        (key === "link" || key === "链接") ? (
                                        <a
                                          href={value}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="underline hover:text-primary active:text-primary active:scale-95   
  transition-all duration-200"
                                        >
                                          {value}
                                        </a>
                                      ) : value.startsWith("http") &&
                                        !isAudioByExt(value) ? (
                                        <iframe
                                          src={value}
                                          title={key}
                                          className="w-full h-64 rounded border mt-2"
                                          allowFullScreen
                                        />
                                      ) : !isAudioByExt(value) ? (
                                        <span className="whitespace-pre-line">{String(value)}</span>
                                      ) : null}
                                    </p>
                                  ) : (
                                    <div className="flex flex-col space-y-4">
                                      <b className="text-primary">
                                        {key.charAt(0).toUpperCase() +
                                          key.slice(1)}
                                        :
                                      </b>{" "}
                                      <ReactPlayer
                                        url={value as string}
                                        playing={false}
                                        controls
                                        height="100px"
                                        width="100%"
                                        className="self-center"
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
                                  )),
                              )}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
              {result.category}
            </span>
            {result.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs border border-border"
              >
                {tag}
              </span>
            ))}
          </div>
          <br></br>
          {!isLoading && related && Object.values(related).flat().length > 0 ? (
            <>
              {related?.apps?.length > 0 && (
                <DisplayRelatedAppsorLinks
                  title={t("relatedApps")}
                  related={related?.apps}
                  data={result}
                />
              )}

              {related?.links?.length > 0 && (
                <DisplayRelatedAppsorLinks
                  title={t("relatedLinks")}
                  related={related?.links}
                  data={result}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

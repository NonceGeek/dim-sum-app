import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type SearchResult } from "@/lib/api/search";
import ReactPlayer from "react-player";
import { DictionaryNote } from "@/lib/types";

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
  return (
    <Card className="p-6 shadow-md hover:bg-primary/5 dark:hover:bg-gray-800 transition-colors duration-200 mb-2">
      <div className="space-y-6">
        <div className="prose dark:prose-invert max-w-none relative">
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {result.data}
            </h3>
            <Button
              onClick={() => {
                setEditingResult(result);
                setUpdateDialogOpen(true);
              }}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white h-12 px-6"
            >
              Update
            </Button>
          </div>
        </div>
        <div className="mt-2 gray_text_sm space-y-4">
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
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700 space-y-2">
                      {result.note.context.meaning && (
                        <p className="leading-relaxed">
                          <b className="text-fuchsia-300">釋義：</b>{" "}
                          {Array.isArray(result.note.context.meaning)
                            ? result.note.context.meaning.join("、 ")
                            : result.note.context.meaning}
                        </p>
                      )}
                      {result.note.context.pinyin && (
                        <p className="leading-relaxed">
                          <b className="text-fuchsia-300">粵拼：</b>{" "}
                          {Array.isArray(result.note.context.pinyin)
                            ? result.note.context.pinyin.join("、 ")
                            : result.note.context.pinyin}
                        </p>
                      )}
                      {result.note.contributor && (
                        <p className="leading-relaxed">
                          <b className="text-fuchsia-300">貢獻者：</b>{" "}
                          {result.note.contributor}
                        </p>
                      )}
                      {result.note.context.page && (
                        <p className="leading-relaxed">
                          <b className="text-fuchsia-300">頁碼：</b>{" "}
                          {result.note.context.page}
                        </p>
                      )}
                      {result.note.context.number && (
                        <p className="leading-relaxed">
                          <b className="text-fuchsia-300">編號：</b>{" "}
                          {result.note.context.number}
                        </p>
                      )}
                      {result.note.context.others && (
                        <p className="leading-relaxed">
                          <b className="text-fuchsia-300">其他：</b>{" "}
                          {JSON.stringify(result.note.context.others)}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                // Simple display for other categories
                <div>
                  {typeof result.note === "object" &&
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
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                              <p className="whitespace-pre-line leading-relaxed">
                                <b className="text-fuchsia-300">Subtitles:</b>{" "}
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
                          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700 space-y-2">
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
                                  value && (
                                    <p className="leading-relaxed" key={key}>
                                      <b className="text-fuchsia-300">
                                        {key.charAt(0).toUpperCase() +
                                          key.slice(1)}
                                        :
                                      </b>{" "}
                                      {Array.isArray(value) ? (
                                        value.join(", ")
                                      ) : typeof value === "string" &&
                                        value.startsWith("http") ? (
                                        <iframe
                                          src={value}
                                          title={key}
                                          className="w-full h-64 rounded border mt-2"
                                          allowFullScreen
                                        />
                                      ) : (
                                        String(value)
                                      )}
                                    </p>
                                  )
                              )}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="px-3 py-1 bg-primary/10 text-fuchsia-300 rounded-full text-xs font-medium border border-primary/20">
              {result.category}
            </span>
            {result.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs border border-gray-200 dark:border-gray-700"
              >
                {tag}
              </span>
            ))}
          </div>
          <br></br>
          {(result.category === "广州话正音字典" ||
            result.category === "广州话正音字典（例）") && (
            <div>
              <p>
                关联应用:&nbsp;&nbsp;&nbsp;
                <a
                  href={`https://card.app.aidimsum.com/?uuid=${result.unique_id}`}
                  target="_blank"
                  className="px-3 py-1 bg-primary/10 bg-fuchsia-300 rounded-full text-xs font-medium border border-primary/20"
                >
                  🎴 卡片生成
                </a>
                {/* TODO: Be implemented in the future. */}
                {/* <br></br>
                                <br></br>
                                推荐应用:&nbsp;&nbsp;&nbsp;
                                <a
                                  href={`https://baidu.com?uuid=${result.unique_id}`}
                                  target="_blank"
                                  className="px-3 py-1 bg-primary/10 bg-fuchsia-300 rounded-full text-xs font-medium border border-primary/20"
                                >
                                  🤖 语言学 Agent
                                </a> */}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

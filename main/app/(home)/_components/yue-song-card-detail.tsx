import { Card } from "@/components/ui/card";
import { corpusInteractApi } from "@/lib/api/corpus-interact";
import { SearchResult } from "@/lib/api/search";
import { CirclePlay, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function YueSongCardDetail({
  result,
}: {
  result: SearchResult;
}) {
  const router = useRouter();

  return (
    <Card className="p-6 shadow-md hover:bg-primary/5 dark:hover:bg-gray-800 transition-colors duration-200 mb-2">
      <div className="space-y-6">
        <div className="prose dark:prose-invert max-w-none relative">
          <div className="flex justify-between gap-4">
            <div>
              <div className="flex">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 mr-2">
                  {result.note.context.song_name}
                </h3>
                <span className="gray_text_sm relative -bottom-2">
                  {result.note.context.author}/{result.note.context.album}
                </span>
              </div>
              <div className="gray_text_sm flex items-center whitespace-pre-line">
                <div>{result.note.context.introduction}</div>
              </div>
            </div>

            <div className="text-indigo-500 flex gap-4 items-center">
              <CirclePlay
                className="cursor-pointer"
                onClick={(e) => {
                  corpusInteractApi.updateView(result.unique_id);
                  router.push(`/yueSong?id=${result.unique_id}`);
                }}
              />
              <a
                href={`https://card.app.aidimsum.com/?uuid=${result.unique_id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e: any) => {
                  const url = e.currentTarget.href;
                  navigator.clipboard.writeText(url).then(() => {
                    toast("Link copied.");
                  });
                }}
              >
                <Share2 className="cursor-pointer" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

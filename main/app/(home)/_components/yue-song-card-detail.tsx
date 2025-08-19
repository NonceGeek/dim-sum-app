import { Card } from "@/components/ui/card";
import { SearchResult } from "@/lib/api/search";
import { CirclePlay, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";

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
          <div className="flex items-start">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 mr-2">
              {result.note.context.title}
            </h3>
            <span className="gray_text_sm relative -bottom-2">
              {result.note.context.artist}/{result.note.context.album}
            </span>
          </div>
          <div className="gray_text_sm flex justify-between items-center">
            <div>{result.note.context.description}</div>
            <div className="text-indigo-500 flex gap-4">
              <CirclePlay
                className="hover:cursor-pointer"
                onClick={(e) => router.push(`/yueSong?id=${1}`)}
              />
              <Share2 />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { getCorpusItemByUniqueId, SearchResult } from "@/lib/api/search";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react"; // Speaker Icon
import { useParams } from "next/navigation";

// Mock data to represent the detailed structure, will be replaced by API data
const mockDetailedData = {
  related_documents: [
    { name: "文献1", link: "www.xxxxxxxx.com" },
    { name: "文献2", link: "www.xxxxxxxx.com" },
  ],
  video_clips: [
    { name: "clip1", link: "www.xxxxxxxx.com" },
    { name: "clip2", link: "www.xxxxxxxx.com" },
  ],
};

const buttonClass =
  "rounded-full border border-gray-400 px-6 py-2 text-white bg-transparent hover:bg-gray-700 transition-colors duration-150";

export default function CorpusItemDetailsPage() {
  const params = useParams();
  const uuid = params?.uuid as string;

  const [item, setItem] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) return;

    async function loadItem() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getCorpusItemByUniqueId(uuid);
        if (result) {
          setItem(result);
        } else {
          setError("Corpus item not found.");
        }
      } catch (err) {
        console.error("Failed to load item:", err);
        setError("Failed to load corpus item. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    loadItem();
  }, [uuid]);

  if (isLoading) {
    return Array.from({ length: 3 }).map((_, index) => (
      <Card key={index} className="p-6 bg-card">
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-24 w-full" />
      </Card>
    ));
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-red-500">
        {error}
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        Corpus item not found.
      </div>
    );
  }

  // Assuming 'meaning' array corresponds to 'pinyin' array
  const mainInfoRows =
    item.note?.context?.pinyin?.map((p, i) => ({
      pinyin: p,
      words:
        (item.note?.context?.meaning && item.note.context.meaning[i]) || "N/A", // Placeholder for "组词"
      sentence: "做人一定要识得先爱护自己，而后爱人。", // Placeholder for "句子"
    })) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex gap-2">
          <Button className={buttonClass}>Create</Button>
          <Button className={buttonClass}>Save</Button>
          <Button className={buttonClass}>Delete</Button>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Main Info Table */}
        <Card className="p-6 bg-card">
          <Table className="w-full border-collapse overflow-hidden bg-transparent text-white text-base border border-white/20">
            <TableHeader>
              <TableRow className="bg-[#23242a]">
                <TableHead className="w-24 text-center border-r border-gray-600 text-white text-base">
                  字
                </TableHead>
                <TableHead className="w-48 text-center border-r border-gray-600 text-white text-base">
                  粤音
                </TableHead>
                <TableHead className="w-1/2 text-center border-r border-gray-600 text-white text-base">
                  组词
                </TableHead>
                <TableHead className="text-center text-white text-base">
                  句子
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mainInfoRows.map((row, index) => (
                <TableRow key={index} className="border-t border-gray-600">
                  {index === 0 && (
                    <TableCell
                      rowSpan={mainInfoRows.length}
                      className="text-center border-r border-gray-600 align-middle text-2xl"
                    >
                      {item.data}
                    </TableCell>
                  )}
                  <TableCell className="border-r border-gray-600">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-5 w-5 cursor-pointer hover:text-purple-400" />
                      <span>音节: {row.pinyin}</span>
                    </div>
                  </TableCell>
                  <TableCell className="border-r border-gray-600">
                    {row.words}
                  </TableCell>
                  <TableCell>{row.sentence}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Related Documents Table */}
        <Card className="p-6 bg-card">
          <Table className="w-full border-collapse overflow-hidden bg-transparent text-white text-base border border-white/20">
            <TableHeader>
              <TableRow className="bg-[#23242a]">
                <TableHead className="w-1/3 text-center border-r border-gray-600 text-white text-base">
                  相关文献
                </TableHead>
                <TableHead className="text-center text-white text-base">
                  链接
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockDetailedData.related_documents.map((doc, index) => (
                <TableRow key={index} className="border-t border-gray-600">
                  <TableCell className="text-center border-r border-gray-600">
                    {doc.name}
                  </TableCell>
                  <TableCell className="text-center border-r border-gray-600">
                    {doc.link}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Video Clips Table */}
        <Card className="p-6 bg-card">
          <Table className="w-full border-collapse overflow-hidden bg-transparent text-white text-base border border-white/20">
            <TableHeader>
              <TableRow className="bg-[#23242a]">
                <TableHead className="w-1/3 text-center border-r border-gray-600 text-white text-base">
                  视频切片
                </TableHead>
                <TableHead className="text-center text-white text-base">
                  链接
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockDetailedData.video_clips.map((clip, index) => (
                <TableRow key={index} className="border-t border-gray-600">
                  <TableCell className="text-center border-r border-gray-600">
                    {clip.name}
                  </TableCell>
                  <TableCell className="text-center border-r border-gray-600">
                    {clip.link}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

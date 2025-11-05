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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Volume2, Edit, Eye, Plus, Trash2, ArrowLeft } from "lucide-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { editApi } from "@/lib/api/edit-corpus";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store/useAuthStore";


const buttonClass =
  "rounded-full border border-gray-400 px-6 py-2 text-white bg-transparent hover:bg-gray-700 transition-colors duration-150";

export default function CorpusItemDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const uuid = params?.uuid as string;
  const mode = searchParams.get('mode') || 'view'; // 'view' or 'edit'

  const [item, setItem] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(mode === 'edit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Edit state
  const [editPinyin, setEditPinyin] = useState<string[]>([]);
  const [editMeanings, setEditMeanings] = useState<string[]>([]);
  const [editSentences, setEditSentences] = useState<string[]>([]);
  const [editRelatedDocs, setEditRelatedDocs] = useState<{name: string, link: string}[]>([]);
  const [editVideoClips, setEditVideoClips] = useState<{name: string, link: string}[]>([]);

  const { user } = useAuthStore();
  
  // Check if user can edit
  const canEdit = user?.role === 'TAGGER_PARTNER' || user?.role === 'TAGGER_OUTSOURCING';

  // Handle back to list
  const handleBack = () => {
    router.push('/account/data-annotation');
  };

  useEffect(() => {
    if (!uuid) return;

    async function loadItem() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getCorpusItemByUniqueId(uuid);
        if (result) {
          setItem(result);
          
          // Initialize edit state from item data
          const context = result.note?.context;
          if (context) {
            // Initialize pinyin
            const pinyinData = context.pinyin;
            if (Array.isArray(pinyinData)) {
              setEditPinyin([...pinyinData]);
            } else {
              setEditPinyin([pinyinData || ""]);
            }
            
            // Initialize meanings
            const meaningData = context.meaning;
            if (Array.isArray(meaningData)) {
              setEditMeanings([...meaningData]);
            } else {
              setEditMeanings([meaningData || ""]);
            }
            
            // Initialize sentences
            const sentenceData = (context as any).sentence;
            if (Array.isArray(sentenceData)) {
              setEditSentences([...sentenceData]);
            } else {
              setEditSentences([sentenceData || ""]);
            }
            
            // Initialize related documents
            const relatedDocsData = (context as any).related_documents;
            if (Array.isArray(relatedDocsData)) {
              setEditRelatedDocs([...relatedDocsData]);
            } else {
              setEditRelatedDocs([{ name: "", link: "" }]);
            }
            
            // Initialize video clips
            const videoClipsData = (context as any).video_clips;
            if (Array.isArray(videoClipsData)) {
              setEditVideoClips([...videoClipsData]);
            } else {
              setEditVideoClips([{ name: "", link: "" }]);
            }
          }
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

  // Save function
  const handleSave = async () => {
    if (!item || !canEdit) {
      toast.error("没有编辑权限");
      return;
    }

    setIsSubmitting(true);
    try {
      const noteData = {
        pinyin: editPinyin,
        meaning: editMeanings,
        sentence: editSentences,
        related_documents: editRelatedDocs,
        video_clips: editVideoClips,
        contributor: user?.name || "Anonymous",
      };

      const response = await editApi.updateCorpusItem({
        uuid: item.unique_id,
        note: noteData,
        category: item.category || "zyzdv2",
      });

      toast.success(`数据保存成功！历史ID: ${response.history_id}, 状态: ${response.status}`);
      setIsEditing(false);
      
      // Reload item to get updated data
      const result = await getCorpusItemByUniqueId(uuid);
      if (result) {
        setItem(result);
      }
    } catch (error) {
      console.error("保存失败:", error);
      toast.error("保存数据失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit handlers
  const addPinyinRow = () => setEditPinyin([...editPinyin, ""]);
  const removePinyinRow = (index: number) => {
    if (editPinyin.length > 1) {
      setEditPinyin(editPinyin.filter((_, i) => i !== index));
    }
  };

  const addMeaningRow = () => setEditMeanings([...editMeanings, ""]);
  const removeMeaningRow = (index: number) => {
    if (editMeanings.length > 1) {
      setEditMeanings(editMeanings.filter((_, i) => i !== index));
    }
  };

  const addSentenceRow = () => setEditSentences([...editSentences, ""]);
  const removeSentenceRow = (index: number) => {
    if (editSentences.length > 1) {
      setEditSentences(editSentences.filter((_, i) => i !== index));
    }
  };

  const addRelatedDocRow = () => setEditRelatedDocs([...editRelatedDocs, {name: "", link: ""}]);
  const removeRelatedDocRow = (index: number) => {
    if (editRelatedDocs.length > 1) {
      setEditRelatedDocs(editRelatedDocs.filter((_, i) => i !== index));
    }
  };

  const addVideoClipRow = () => setEditVideoClips([...editVideoClips, {name: "", link: ""}]);
  const removeVideoClipRow = (index: number) => {
    if (editVideoClips.length > 1) {
      setEditVideoClips(editVideoClips.filter((_, i) => i !== index));
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="h-6 w-px bg-gray-600" />
            <Skeleton className="h-8 w-32" />
          </div>
          <Skeleton className="h-10 w-20" />
        </div>

        {/* Main Info Table Skeleton */}
        <Card className="p-6 bg-card mb-8">
          <Skeleton className="h-8 w-full mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </Card>

        {/* Related Documents Skeleton */}
        <Card className="p-6 bg-card mb-8">
          <Skeleton className="h-6 w-24 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>

        {/* Video Clips Skeleton */}
        <Card className="p-6 bg-card">
          <Skeleton className="h-6 w-20 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
      </div>
    );
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

  // Get data from item.note?.context
  const context = item?.note?.context as any;
  const mainInfoRows =
    context?.pinyin?.map((p: any, i: number) => ({
      pinyin: p,
      words: (context?.meaning && context.meaning[i]) || "N/A", // 组词
      sentence: (context?.sentence && context.sentence[i]) || "N/A", // 句子
    })) || [];

  // Get related documents from context
  const relatedDocuments = context?.related_documents || [];

  // Get video clips from context
  const videoClips = context?.video_clips || [];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-6 h-6" />
            {/* 返回列表 */}
          </Button>
          <div className="h-6 w-px bg-gray-600" />
          <h1 className="text-xl font-bold text-gray-300">
            {isEditing ? "编辑数据" : "数据详情"}
          </h1>
          {/* {item && (
            <span className="text-lg text-gray-500">
              {item.data}
            </span>
          )} */}
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              {isEditing ? (
                <>
                  <Button 
                    className={buttonClass} 
                    onClick={handleSave}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "保存中..." : "保存"}
                  </Button>
                  <Button 
                    className={buttonClass}
                    onClick={() => setIsEditing(false)}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button 
                  className={buttonClass}
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  编辑
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {/* Main Info Table */}
        <Card className="p-6 bg-card">
          <Table className="w-full border-collapse overflow-hidden bg-transparent text-white text-base border border-white/20 table-fixed">
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
              {isEditing ? (
                // Edit mode
                editPinyin.map((pinyin, index) => (
                  <TableRow key={index} className="border-t border-gray-600">
                    {index === 0 && (
                      <TableCell
                        rowSpan={editPinyin.length}
                        className="text-center border-r border-gray-600 align-middle text-2xl"
                      >
                        {item.data}
                      </TableCell>
                    )}
                    <TableCell className="border-r border-gray-600">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-5 w-5 cursor-pointer hover:text-purple-400" />
                        <Input
                          value={pinyin}
                          onChange={(e) => {
                            const newPinyin = [...editPinyin];
                            newPinyin[index] = e.target.value;
                            setEditPinyin(newPinyin);
                          }}
                          className="w-full"
                          placeholder="音节"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removePinyinRow(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-gray-600 whitespace-normal">
                      <Textarea
                        value={editMeanings[index] || ""}
                        onChange={(e) => {
                          const newMeanings = [...editMeanings];
                          newMeanings[index] = e.target.value;
                          setEditMeanings(newMeanings);
                        }}
                        placeholder="组词"
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Textarea
                        value={editSentences[index] || ""}
                        onChange={(e) => {
                          const newSentences = [...editSentences];
                          newSentences[index] = e.target.value;
                          setEditSentences(newSentences);
                        }}
                        placeholder="句子"
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                // View mode
                mainInfoRows.map((row: any, index: number) => (
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
                    <TableCell className="border-r border-gray-600 whitespace-normal">
                      {row.words}
                    </TableCell>
                    <TableCell className="whitespace-normal">{row.sentence}</TableCell>
                  </TableRow>
                ))
              )}
              {isEditing && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    <Button onClick={addPinyinRow} variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      添加行
                    </Button>
                  </TableCell>
                </TableRow>
              )}
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
              {isEditing ? (
                // Edit mode
                <>
                  {editRelatedDocs.map((doc, index) => (
                    <TableRow key={index} className="border-t border-gray-600">
                      <TableCell className="border-r border-gray-600">
                        <div className="flex items-center gap-2">
                          <Input
                            value={doc.name}
                            onChange={(e) => {
                              const newDocs = [...editRelatedDocs];
                              newDocs[index] = { ...newDocs[index], name: e.target.value };
                              setEditRelatedDocs(newDocs);
                            }}
                            placeholder="文献名称"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeRelatedDocRow(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={doc.link}
                          onChange={(e) => {
                            const newDocs = [...editRelatedDocs];
                            newDocs[index] = { ...newDocs[index], link: e.target.value };
                            setEditRelatedDocs(newDocs);
                          }}
                          placeholder="链接"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} className="text-center">
                      <Button onClick={addRelatedDocRow} variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        添加文献
                      </Button>
                    </TableCell>
                  </TableRow>
                </>
              ) : (
                // View mode
                relatedDocuments.length > 0 ? (
                  relatedDocuments.map((doc: any, index: number) => (
                    <TableRow key={index} className="border-t border-gray-600">
                      <TableCell className="text-center border-r border-gray-600">
                        {doc.name || "N/A"}
                      </TableCell>
                      <TableCell className="text-center border-r border-gray-600">
                        {doc.link || "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-t border-gray-600">
                    <TableCell colSpan={2} className="text-center text-gray-500 py-4">
                      没有相关文献数据
                    </TableCell>
                  </TableRow>
                )
              )}
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
              {isEditing ? (
                // Edit mode
                <>
                  {editVideoClips.map((clip, index) => (
                    <TableRow key={index} className="border-t border-gray-600">
                      <TableCell className="border-r border-gray-600">
                        <div className="flex items-center gap-2">
                          <Input
                            value={clip.name}
                            onChange={(e) => {
                              const newClips = [...editVideoClips];
                              newClips[index] = { ...newClips[index], name: e.target.value };
                              setEditVideoClips(newClips);
                            }}
                            placeholder="视频名称"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeVideoClipRow(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={clip.link}
                          onChange={(e) => {
                            const newClips = [...editVideoClips];
                            newClips[index] = { ...newClips[index], link: e.target.value };
                            setEditVideoClips(newClips);
                          }}
                          placeholder="链接"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} className="text-center">
                      <Button onClick={addVideoClipRow} variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        添加视频
                      </Button>
                    </TableCell>
                  </TableRow>
                </>
              ) : (
                // View mode
                videoClips.length > 0 ? (
                  videoClips.map((clip: any, index: number) => (
                    <TableRow key={index} className="border-t border-gray-600">
                      <TableCell className="text-center border-r border-gray-600">
                        {clip.name || "N/A"}
                      </TableCell>
                      <TableCell className="text-center border-r border-gray-600">
                        {clip.link || "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-t border-gray-600">
                    <TableCell colSpan={2} className="text-center text-gray-500 py-4">
                      没有视频切片数据
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

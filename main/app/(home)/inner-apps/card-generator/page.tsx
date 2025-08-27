"use client";

// TODO: make the card generator as a solo app.

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAppStore } from "@/stores/use-app-store";
import domtoimage from 'dom-to-image';
import { Download } from 'lucide-react';

interface DictionaryNote {
  page?: number;
  number?: string;
  others?: {
    異體?: any[];
    校訂註?: string | null;
  };
  pinyin?: string[];
  meaning?: string[];
  contributor?: string;
}

interface ArrayNote {
  context: {
    pron?: string;
    author?: string;
    video?: string;
    subtitle?: string;
    [key: string]: any;
  };
  contributor?: string;
}

type Note = DictionaryNote | ArrayNote[];

interface CorpusItem {
  id: string;
  unique_id: string;
  data: string;
  category: string;
  note: Note;
  tags: string[];
}

// Add this mapping object at the top of the file, after the interfaces
const keyTranslations: { [key: string]: string } = {
  'word': '同音字',
  'pinyin': '拼音',
  'meaning': '含义',
  'phrases': '词组',
  'chinese_pinyin': '普通话拼音',
  'pron': '粵拼',
  'author': '作者'
};

const colorOptions = [
  { name: 'Default', value: 'bg-[#ffffff]' },
  { name: 'Blue', value: 'bg-[#f0f7ff]' },
  { name: 'Green', value: 'bg-[#f0fff4]' },
  { name: 'Purple', value: 'bg-[#faf5ff]' },
  { name: 'Pink', value: 'bg-[#fff5f7]' },
  { name: 'Yellow', value: 'bg-[#fffbeb]' },
];

// Type guard for dictionary note
function isDictionaryNote(note: Note): note is DictionaryNote {
  return !Array.isArray(note) && 'meaning' in note;
}

// YueCard component definition
const YueCard = ({ item }: { item: CorpusItem }) => {
  const [selectedColor, setSelectedColor] = useState(colorOptions[0].value);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
      const dataUrl = await domtoimage.toPng(cardRef.current, {
        quality: 1.0,
        bgcolor: '#ffffff',
        style: {
          'transform': 'scale(1)',
          'transform-origin': 'top left'
        }
      });

      const link = document.createElement('a');
      link.download = `yue-card-${item.data}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {colorOptions.map((color) => (
          <button
            key={color.name}
            onClick={() => setSelectedColor(color.value)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              selectedColor === color.value 
                ? 'border-[#3b82f6] scale-110' 
                : 'border-transparent hover:scale-105'
            } ${color.value}`}
            title={color.name}
          />
        ))}
      </div>
      
      <div ref={cardRef} className={`p-6 shadow-md rounded-lg border border-[#e5e7eb] ${selectedColor}`}>
        <div className="space-y-6">
          <div className="prose max-w-none">
            <h1 className="text-4xl font-semibold text-[#111827] mb-4">{item.data}</h1>
          </div>
          <div className="mt-2 text-sm text-[#4b5563] space-y-4">
            {!Array.isArray(item.note) ? (
              // Dictionary note display
              <div className="bg-[#ffffff]/50 p-4 rounded-lg border border-[#f3f4f6] space-y-2">
                {(item.note as DictionaryNote).meaning && (
                  <p className="leading-relaxed">
                    <b className="text-[#3b82f6]">釋義：</b>{" "}
                    {Array.isArray((item.note as DictionaryNote).meaning) 
                      ? (item.note as DictionaryNote).meaning.map((m, idx) => (
                          <span key={idx}>
                            {m}
                            {idx < (item.note as DictionaryNote).meaning.length - 1 && <br />}
                          </span>
                        ))
                      : (item.note as DictionaryNote).meaning
                    }
                  </p>
                )}
                {(item.note as DictionaryNote).pinyin && (
                  <p className="leading-relaxed">
                    <b className="text-[#3b82f6]">粵拼：</b>{" "}
                    {Array.isArray((item.note as DictionaryNote).pinyin)
                      ? (item.note as DictionaryNote).pinyin.join("、 ")
                      : (item.note as DictionaryNote).pinyin
                    }
                  </p>
                )}
                {(item.note as DictionaryNote).contributor && (
                  <p className="leading-relaxed">
                    <b className="text-[#3b82f6]">貢獻者：</b>{" "}
                    {(item.note as DictionaryNote).contributor}
                  </p>
                )}
                {(item.note as DictionaryNote).page && (
                  <p className="leading-relaxed">
                    <b className="text-[#3b82f6]">頁碼：</b>{" "}
                    {(item.note as DictionaryNote).page}
                  </p>
                )}
                {(item.note as DictionaryNote).number && (
                  <p className="leading-relaxed">
                    <b className="text-[#3b82f6]">編號：</b>{" "}
                    {(item.note as DictionaryNote).number}
                  </p>
                )}
                {(item.note as DictionaryNote).others && (
                  <p className="leading-relaxed">
                    <b className="text-[#3b82f6]">其他：</b>{" "}
                    {JSON.stringify((item.note as DictionaryNote).others)}
                  </p>
                )}
              </div>
            ) : (
              // Array note display
              item.note.map((note, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="bg-[#ffffff]/50 p-4 rounded-lg border border-[#f3f4f6] space-y-2">
                    {Object.entries(note.context)
                      .filter(([key]) => key !== "video" && key !== "subtitle")
                      .map(([key, value]) => (
                        value && (
                          <p className="leading-relaxed" key={key}>
                            <b className="text-[#3b82f6]">
                              {keyTranslations[key] || key}:
                            </b>{" "}
                            {Array.isArray(value) ? value.join(", ") : value}
                          </p>
                        )
                      ))}
                  </div>
                </div>
              ))
            )}
            {/* TODO: 智能发音 */}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white rounded-lg hover:bg-[#2563eb] transition-colors"
        >
          <Download className="w-4 h-4" />
          下载卡片
        </button>
      </div>
    </div>
  );
};

// Create a client component for the main content
function CardGeneratorContent() {
  const searchParams = useSearchParams();
  const [item, setItem] = useState<CorpusItem | null>(null);
  const [loading, setLoading] = useState(true);
  const setTheme = useAppStore((state) => state.setTheme);

  useEffect(() => {
    setTheme('light');
  }, [setTheme]);

  useEffect(() => {
    const uniqueId = searchParams.get('uuid');
    if (!uniqueId) {
      toast.error("No unique ID provided");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + `/corpus_item?unique_id=${uniqueId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const data = await response.json();
        setItem(data[0]);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3b82f6]"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500">No data found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <center><h1 className="text-4xl font-bold mb-8">粤语单词卡片生成器</h1></center>
      
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-6 max-w-4xl">
          {item && <YueCard item={item} />}
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense
export default function CardGeneratorPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3b82f6]"></div>
      </div>
    }>
      <CardGeneratorContent />
    </Suspense>
  );
} 
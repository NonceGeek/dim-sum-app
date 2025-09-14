"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";

// Mock data for the library
// const mockBooks = [
//   {
//     id: 1,
//     title: "粤语正字字典",
//     author: "Mocker",
//     description: "一本粤语正字字典",
//     coverImage: "/yuedian.png",
//     likes: 342,
//     comments: 56,
//   },
//   {
//     id: 2,
//     title: "粤语正音字典",
//     author: "Mocker",
//     description: "一本粤语正音字典",
//     coverImage: "/yuedian.png",
//     likes: 512,
//     comments: 78,
//   },
//   {
//     id: 3,
//     title: "粤语地图",
//     author: "Mocker",
//     description: "基于 LBS 的粤语地图",
//     coverImage: "/yuedian.png",
//     likes: 423,
//     comments: 92,
//   },
//   {
//     id: 4,
//     title: "粤语极速入门⚡",
//     author: "Mocker",
//     description: "又快又有趣，让你极速入门粤语",
//     coverImage: "/yuedian.png",
//     likes: 387,
//     comments: 64,
//   },
// ];

// Define a Book interface for type safety
type Book = {
  id: number;
  title: string;
  author: string;
  coverImage: string;
  description: string;
  likes: number;
  comments: number;
  link?: string; // Optional link property
};

interface Corpus {
  id: number;
  name: string;
  nickname: string;
  description: string;
  cover: string;
  likes: number;
  comments: number;
  tags: string[];
  link: string;
  pinned: boolean;
  status: "INPROGRESS" | "RAW";
}

// Create a client component for the book card
import Image from "next/image";

function BookCard({ book }: { book: Book }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <a href={book.link} target="_blank" rel="noopener noreferrer">
        <div className="h-48 bg-gray-200 relative">
          <Image
            src={book.coverImage}
            alt={`Cover of ${book.title}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src =
                "https://via.placeholder.com/300x200?text=No+Image";
            }}
            width={300}
            height={200}
            unoptimized
          />
        </div>
        <div className="p-4">
          <h3 className="text-xl font-semibold">{book.title}</h3>
          <p className="text-gray-600 mb-2">{book.author}</p>
          <p className="text-gray-700 text-sm mb-4 line-clamp-2">
            {book.description}
          </p>
          {/* TODO: impl in the future.
         <div className="flex justify-between text-sm text-gray-500">
          <span>❤️ {book.likes}</span>
          <span>💬 {book.comments}</span>
        </div> */}
        </div>
      </a>
    </div>
  );
}

function CorpusCard({ corpus }: { corpus: Corpus }) {
  const getTagDisplay = (tag: string): string => {
    switch (tag.toLowerCase()) {
      case "classic":
        return "经典";
      case "dict":
        return "字典";
      default:
        return tag;
    }
  };

  const getStatusDisplay = (status: string): string => {
    switch (status) {
      case "INPROGRESS":
        return "入库中";
      case "RAW":
        return "生语料";
      default:
        return status;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow relative">
      {corpus.pinned && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white rounded-md text-xs z-10">
          置顶
        </div>
      )}
      <div className="h-48 bg-gray-200 relative">
        <Image
          src={corpus.cover}
          alt={`Cover of ${corpus.name}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "/pizza.png";
          }}
          width={300}
          height={200}
          unoptimized
        />
        {/* TODO: to see if this field is necessary. */}
        {/* {corpus.status && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white rounded-md text-xs">
            {getStatusDisplay(corpus.status)}
          </div>
        )} */}
      </div>
      <div className="p-4">
        <h3 className="text-xl font-semibold">{corpus.nickname}</h3>
        <p className="text-gray-600 mb-2 max-h-18 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-gray-100">
          {corpus.description}
        </p>
        {corpus.tags && corpus.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {corpus.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-500 dark:bg-gray-600 text-white rounded-full text-xs border border-gray-400 dark:border-gray-500"
              >
                {getTagDisplay(tag)}
              </span>
            ))}
          </div>
        )}
        {corpus.link && (
          <a
            href={corpus.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 text-sm font-medium"
          >
            👉 查看原始数据
          </a>
        )}
        {/* <div className="flex justify-between text-sm text-gray-500">
          <span>❤️ {corpus.likes}</span>
          <span>💬 {corpus.comments}</span>
        </div> */}
      </div>
    </div>
  );
}

// Keep the main page component as a server component
export default function LibraryPage() {
  const [corpus, setCorpus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCorpus = async () => {
      try {
        const response = await fetch(
          process.env.NEXT_PUBLIC_BACKEND_URL + "/corpus_categories"
        );
        const data = await response.json();
        // Sort the data to put pinned items first
        const sortedData = data.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return 0;
        });
        setCorpus(sortedData);
      } catch (error) {
        console.error("Error fetching books:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCorpus();
  }, []);

  return (
    <>
      <div className="h-full p-6 overflow-auto">
        <div className="flex items-center justify-center w-full mb-8">
          <h1 className="text-4xl font-bold text-center">粤语语料集</h1>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {corpus.map((corpus: Corpus) => (
              <CorpusCard key={corpus.id} corpus={corpus} />
            ))}
          </div>
        )}
      </div>
      {/* TODO: not necessary for now. */}
      {/* <div className="h-full p-6 overflow-auto">
        <div className="flex items-center justify-center w-full mb-8">
          <h1 className="text-4xl font-bold text-center">图书馆</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              id: 1,
              title: "全粤语三国演义",
              author: "李沛聪",
              coverImage:
                "https://dimsum-utils.oss-cn-guangzhou.aliyuncs.com/images.jpeg",
              description:
                "從《三國演義》原著中精選五十回內容，用粵語方言文字重新演繹，令讀者體會原汁原味的粵語故事。",
              likes: 0,
              comments: 0,
              created_at: "2025-06-19 11:20:58.940891+00",
              updated_at: "2025-06-19 11:20:58.940891",
              link: "https://item.jd.com/10069527822270.html",
            },
          ].map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </div> */}
    </>
  );
}

// Add the "use client" directive to make this a client component
"use client"

import { useState, useEffect } from "react";
import { Header } from '@/components/layout/header';

// Mock data for the library
const mockBooks = [
  {
    id: 1,
    title: '粤语正字字典',
    author: 'Mocker',
    description: '一本粤语正字字典',
    coverImage: '/yuedian.png',
    likes: 342,
    comments: 56
  },
  {
    id: 2,
    title: '粤语正音字典',
    author: 'Mocker',
    description: '一本粤语正音字典',
    coverImage: '/yuedian.png',
    likes: 512,
    comments: 78
  },
  {
    id: 3,
    title: '粤语地图',
    author: 'Mocker',
    description: '基于 LBS 的粤语地图',
    coverImage: '/yuedian.png',
    likes: 423,
    comments: 92
  },
  {
    id: 4,
    title: '粤语极速入门⚡',
    author: 'Mocker',
    description: '又快又有趣，让你极速入门粤语',
    coverImage: '/yuedian.png',
    likes: 387,
    comments: 64
  }
];

// Define a Book interface for type safety
interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
  coverImage: string;
  likes: number;
  comments: number;
}

interface Corpus {
  id: number;
  name: string;
  nickname: string;
  description: string;
  cover: string;
  likes: number;
  comments: number;
}

// Create a client component for the book card
import Image from 'next/image';

function BookCard({ book }: { book: Book }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="h-48 bg-gray-200 relative">
        <Image 
          src={book.coverImage} 
          alt={`Cover of ${book.title}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/300x200?text=No+Image';
          }}
          width={300}
          height={200}
          unoptimized
        />
      </div>
      <div className="p-4">
        <h3 className="text-xl font-semibold">{book.title}</h3>
        <p className="text-gray-600 mb-2">{book.author}</p>
        <p className="text-gray-700 text-sm mb-4 line-clamp-2">{book.description}</p>
        <div className="flex justify-between text-sm text-gray-500">
          <span>❤️ {book.likes}</span>
          <span>💬 {book.comments}</span>
        </div>
      </div>
    </div>
  );
}

function CorpusCard({ corpus }: { corpus: Corpus }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="h-48 bg-gray-200 relative">
        <Image 
          src={corpus.cover} 
          alt={`Cover of ${corpus.name}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/pizza.png';
          }}
          width={300}
          height={200}
          unoptimized
        />
      </div>
      <div className="p-4">
        <h3 className="text-xl font-semibold">{corpus.nickname}</h3>
        <p className="text-gray-600 mb-2">{corpus.description}</p>
        <div className="flex justify-between text-sm text-gray-500">
          <span>❤️ {corpus.likes}</span>
          <span>💬 {corpus.comments}</span>
        </div>
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
        const response = await fetch("https://dim-sum-prod.deno.dev/corpus_categories");
        const data = await response.json();
        setCorpus(data);
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
      <Header />
      <div className="h-[calc(100vh-56px)] p-6 overflow-auto">
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
      {/* TODO: 两个 div 间距离太宽 */}
      <div className="h-[calc(100vh-56px)] p-6 overflow-auto">
        <div className="flex items-center justify-center w-full mb-8">
          <h1 className="text-4xl font-bold text-center">图书馆</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </div>
    </>
  );
} 
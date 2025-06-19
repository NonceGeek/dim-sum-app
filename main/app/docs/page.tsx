'use client';

import { Header } from '@/components/layout/header';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, BookOpen } from 'lucide-react';
import { useState } from 'react';
import readmeContent from '../../public/apidoc.md';

export default function DocsPage() {
  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    } else {
      console.log('Target element not found:', targetId);
    }
  };

  const navigationItems = [
    { id: 'public-apis', label: 'Public APIs' },
    { id: 'developer-apis-api-key-required', label: 'Developer APIs' },
    { id: 'admin-apis-password-required', label: 'Admin APIs' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'data-structures', label: 'Data Structures' },
  ];

  const SidebarContent = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wider">
        API Documentation
      </h3>
      <nav className="space-y-2">
        {navigationItems.map((item) => (
          <a 
            key={item.id}
            href={`#${item.id}`}
            className="block text-sm text-gray-600 hover:text-purple-600 transition-colors duration-200 font-medium cursor-pointer"
            onClick={(e) => handleAnchorClick(e, item.id)}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      <Header />
      <div className="h-[calc(100vh-56px)] flex overflow-hidden">
        {/* 桌面端侧边栏 */}
        <div className="hidden md:block w-64 border-r border-gray-200 bg-transparent p-6 flex-shrink-0">
          <SidebarContent />
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 min-w-0 relative">
          {/* 移动端导航栏（absolute） */}
          <div className="md:hidden absolute top-0 left-0 right-0 z-40 backdrop-blur-md border-b border-gray-200 bg-[linear-gradient(135deg,_#b2c7ff_0%,_#d7d7fe_100%)]">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-2 min-w-0">
                <BookOpen className="h-5 w-5 text-purple-600 flex-shrink-0" />
                <h2 className="text-lg font-semibold text-gray-900 truncate">API Documentation</h2>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center space-x-1 flex-shrink-0">
                    <span className="text-sm">Sections</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[linear-gradient(135deg,_#b2c7ff_0%,_#d7d7fe_100%)] backdrop-blur-md border border-gray-200 shadow-lg">
                  {navigationItems.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleAnchorClick(e as any, item.id);
                      }}
                      className="cursor-pointer text-gray-900 hover:text-purple-700 hover:bg-white/40 font-medium"
                    >
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <ScrollArea className="h-full">
            <div className="p-4 md:p-8 max-w-4xl mx-auto pt-18 md:pt-0">
              <div className="prose prose-gray max-w-none prose-sm md:prose-base prose-p:break-words prose-pre:break-words">
                <ReactMarkdown
                  components={{
                    // 自定义标题样式
                    h1: ({ children }) => (
                      <h1 className="text-2xl md:text-4xl font-bold mb-6 md:mb-8 text-gray-900 border-b-2 border-black-200 pb-3 md:pb-4 break-words">
                        {children}
                      </h1>
                    ),
                    h2: ({ children, id }) => {
                      // 生成标准的锚点ID
                      const generateId = (text: string) => {
                        return text
                          .toLowerCase()
                          .replace(/[^a-z0-9\s-]/g, '')
                          .replace(/\s+/g, '-')
                          .replace(/-+/g, '-')
                          .trim();
                      };
                      
                      const headingId = id || generateId(children as string);
                      
                      return (
                        <h2 
                          id={headingId}
                          className="text-xl md:text-2xl font-semibold mt-8 md:mt-10 mb-4 md:mb-6 text-gray-800 border-l-4 border-purple-500 pl-3 md:pl-4 scroll-mt-20 md:scroll-mt-20 break-words"
                        >
                          {children}
                        </h2>
                      );
                    },
                    h3: ({ children }) => (
                      <h3 className="text-lg md:text-xl font-medium mt-6 md:mt-8 mb-3 md:mb-4 text-gray-700 break-words">
                        {children}
                      </h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="text-base md:text-lg font-medium mt-4 md:mt-6 mb-2 md:mb-3 text-gray-600 break-words">
                        {children}
                      </h4>
                    ),
                    // 自定义代码块样式
                    code: ({ children, className }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="bg-gray-100 text-gray-800 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs md:text-sm font-mono border border-gray-200 break-words">
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className={className}>
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="bg-gray-900 text-gray-100 p-3 md:p-6 rounded-lg md:rounded-xl overflow-x-auto my-4 md:my-6 border border-gray-700 shadow-lg text-xs md:text-sm break-words whitespace-pre-wrap">
                        {children}
                      </pre>
                    ),
                    // 自定义表格样式
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4 md:my-6 rounded-lg border border-gray-200 shadow-sm">
                        <table className="w-full border-collapse min-w-full">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border-b border-gray-200 px-3 md:px-6 py-2 md:py-4 bg-gray-50 font-semibold text-left text-gray-700 text-xs md:text-sm break-words">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border-b border-gray-100 px-3 md:px-6 py-2 md:py-4 text-gray-600 text-xs md:text-sm break-words">
                        {children}
                      </td>
                    ),
                    // 自定义链接样式
                    a: ({ children, href }) => (
                      <a 
                        href={href} 
                        className="text-purple-600 hover:text-purple-700 underline underline-offset-2 transition-colors duration-200 font-medium inline-flex items-center gap-1 text-sm md:text-base break-words"
                        target={href?.startsWith('http') ? '_blank' : undefined}
                        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                      >
                        {children}
                        {href?.startsWith('http') && (
                          <svg className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        )}
                      </a>
                    ),
                    // 自定义列表样式
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-1 md:space-y-2 my-4 md:my-6 text-gray-700 text-sm md:text-base">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-1 md:space-y-2 my-4 md:my-6 text-gray-700 text-sm md:text-base">
                        {children}
                      </ol>
                    ),
                    // 自定义引用样式
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-purple-500 bg-purple-50 pl-4 md:pl-6 py-3 md:py-4 italic text-gray-700 my-4 md:my-6 rounded-r-lg text-sm md:text-base break-words">
                        {children}
                      </blockquote>
                    ),
                    // 自定义分隔线样式
                    hr: () => <Separator className="my-6 md:my-8 bg-gray-200" />,
                    // 自定义段落样式
                    p: ({ children }) => (
                      <p className="my-4 md:my-6 leading-relaxed text-gray-700 text-sm md:text-base break-words">
                        {children}
                      </p>
                    ),
                    // 自定义列表项样式
                    li: ({ children }) => (
                      <li className="text-gray-700 leading-relaxed text-sm md:text-base break-words">
                        {children}
                      </li>
                    ),
                    // 自定义强调样式
                    strong: ({ children }) => (
                      <strong className="font-semibold text-gray-900 text-sm md:text-base break-words">
                        {children}
                      </strong>
                    ),
                    // 自定义斜体样式
                    em: ({ children }) => (
                      <em className="italic text-gray-600 text-sm md:text-base break-words">
                        {children}
                      </em>
                    ),
                  }}
                >
                  {readmeContent}
                </ReactMarkdown>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
} 
"use client";

import { Header } from "@/components/layout/header";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { useState } from "react";
import readmeContent from "../../../public/apidoc.md";

export default function DocsPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const handleAnchorClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string
  ) => {
    e.preventDefault();
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      console.log("Target element not found:", targetId);
    }
  };

  const navigationItems = [
    { 
      id: "get-api-key", 
      label: "GET API KEY!",
      children: []
    },
    { 
      id: "public-apis", 
      label: "Public APIs",
      children: [
        { id: "1-health-check", label: "1. Health Check" },
        { id: "2-get-corpus-apps", label: "2. Get Corpus Apps" },
        { id: "3-get-corpus-categories", label: "3. Get Corpus Categories" },
        { id: "4-get-specific-corpus-category", label: "4. Get Specific Corpus Category" },
        { id: "5-text-search-enhanced", label: "5. Text Search (Enhanced)" },
        { id: "6-get-corpus-item", label: "6. Get Corpus Item" },
        { id: "7-get-random-corpus-item", label: "7. Get Random Corpus Item" },
      ]
    },
    { 
      id: "developer-apis-api-key-required", 
      label: "Developer APIs",
      children: [
        { id: "8-submit-corpus-item-update", label: "8. Submit Corpus Item Update" },
      ]
    },
    { 
      id: "admin-apis-password-required", 
      label: "Admin APIs",
      children: [
        { id: "9-insert-corpus-item-admin", label: "9. Insert Corpus Item (Admin)" },
      ]
    },
    { 
      id: "error-responses", 
      label: "Error Responses",
      children: [
        { id: "400-bad-request", label: "400 Bad Request" },
        { id: "401-unauthorized", label: "401 Unauthorized" },
        { id: "403-forbidden", label: "403 Forbidden" },
        { id: "404-not-found", label: "404 Not Found" },
        { id: "500-internal-server-error", label: "500 Internal Server Error" },
      ]
    },
    { 
      id: "data-structures", 
      label: "Data Structures",
      children: [
        { id: "corpus-item-structure", label: "Corpus Item Structure" },
        { id: "zyzd-item-structure-input", label: "ZYZD Item Structure (Input)" },
      ]
    },
    { 
      id: "authentication", 
      label: "Authentication",
      children: [
        { id: "api-key-authentication", label: "API Key Authentication" },
        { id: "admin-password-authentication", label: "Admin Password Authentication" },
      ]
    },
    { 
      id: "rate-limiting", 
      label: "Rate Limiting",
      children: []
    },
    { 
      id: "support", 
      label: "Support",
      children: []
    },
  ];

  const SidebarContent = () => (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wider">
        API Documentation
      </h3>
      <nav className="space-y-1">
        {navigationItems.map((item) => (
          <div key={item.id}>
            {/* 主菜单项 */}
            <div className="flex items-center">
              <a
                href={`#${item.id}`}
                className="flex-1 text-sm text-gray-600 hover:text-purple-600 transition-colors duration-200 font-medium cursor-pointer py-1"
                onClick={(e) => handleAnchorClick(e, item.id)}
              >
                {item.label}
              </a>
              {/* 展开/折叠按钮 */}
              {item.children && item.children.length > 0 && (
                <button
                  onClick={() => toggleSection(item.id)}
                  className="p-2 ml-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-all duration-200 flex items-center justify-center"
                  title={expandedSections.has(item.id) ? "收起" : "展开"}
                >
                  <ChevronRight 
                    className={`h-4 w-4 font-semibold transition-transform duration-300 ease-in-out ${
                      expandedSections.has(item.id) ? 'rotate-90' : 'rotate-0'
                    }`}
                    style={{
                      transformOrigin: 'center'
                    }}
                  />
                </button>
              )}
            </div>
            
            {/* 子菜单项 */}
            {item.children && item.children.length > 0 && (
              <div 
                className={`ml-4 border-l border-gray-200 pl-3 overflow-hidden transition-all duration-300 ease-out`}
                style={{
                  maxHeight: expandedSections.has(item.id) ? `${item.children.length * 40}px` : '0px',
                  opacity: expandedSections.has(item.id) ? 1 : 0,
                  marginTop: expandedSections.has(item.id) ? '8px' : '0px',
                  marginBottom: expandedSections.has(item.id) ? '4px' : '0px',
                }}
              >
                <div className="space-y-1 py-2">
                  {item.children.map((child, index) => (
                    <a
                      key={child.id}
                      href={`#${child.id}`}
                      className={`block text-xs text-gray-500 hover:text-purple-500 cursor-pointer py-1 px-2 rounded-sm hover:translate-x-1 hover:bg-purple-50 transition-colors duration-150 ${
                        expandedSections.has(item.id) 
                          ? 'translate-x-0 opacity-100' 
                          : 'translate-x-2 opacity-0'
                      }`}
                      style={{
                        transitionProperty: 'transform, opacity',
                        transitionDuration: '200ms',
                        transitionDelay: expandedSections.has(item.id) ? `${index * 50}ms` : '0ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transitionDelay = '0ms';
                        e.currentTarget.style.transitionProperty = 'transform, background-color, color';
                        e.currentTarget.style.transitionDuration = '150ms';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transitionProperty = 'transform, background-color, color';
                        e.currentTarget.style.transitionDuration = '150ms';
                        e.currentTarget.style.transitionDelay = '0ms';
                      }}
                      onClick={(e) => handleAnchorClick(e, child.id)}
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
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
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                API Documentation
              </h2>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-1 flex-shrink-0"
                >
                  <span className="text-sm">Sections</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 max-h-96 overflow-y-auto bg-[linear-gradient(135deg,_#b2c7ff_0%,_#d7d7fe_100%)] backdrop-blur-md border border-gray-200 shadow-lg"
              >
                {navigationItems.map((item) => (
                  <div key={item.id}>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        handleAnchorClick(e as any, item.id);
                      }}
                      className="cursor-pointer text-gray-900 hover:text-purple-700 hover:bg-white/40 font-medium"
                    >
                      {item.label}
                    </DropdownMenuItem>
                    {/* 子菜单项 */}
                    {item.children && item.children.length > 0 && (
                      <div className="ml-4 border-l-2 border-gray-300/50">
                        {item.children.map((child) => (
                          <DropdownMenuItem
                            key={child.id}
                            onClick={(e) => {
                              e.preventDefault();
                              handleAnchorClick(e as any, child.id);
                            }}
                            className="cursor-pointer text-xs text-gray-700 hover:text-purple-600 hover:bg-white/30 pl-3"
                          >
                            {child.label}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    )}
                  </div>
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
                        .replace(/[^a-z0-9\s-]/g, "")
                        .replace(/\s+/g, "-")
                        .replace(/-+/g, "-")
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
                  h3: ({ children, id }) => {
                    // 生成标准的锚点ID
                    const generateId = (text: string) => {
                      return text
                        .toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, "")
                        .replace(/\s+/g, "-")
                        .replace(/-+/g, "-")
                        .trim();
                    };

                    const headingId = id || generateId(children as string);

                    return (
                      <h3 
                        id={headingId}
                        className="text-lg md:text-xl font-medium mt-6 md:mt-8 mb-3 md:mb-4 text-gray-700 scroll-mt-20 md:scroll-mt-20 break-words"
                      >
                        {children}
                      </h3>
                    );
                  },
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
                    return <code className={className}>{children}</code>;
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
                      target={href?.startsWith("http") ? "_blank" : undefined}
                      rel={
                        href?.startsWith("http")
                          ? "noopener noreferrer"
                          : undefined
                      }
                    >
                      {children}
                      {href?.startsWith("http") && (
                        <svg
                          className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
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
    </>
  );
}

import { Header } from '@/components/layout/header';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import readmeContent from '../../public/apidoc.md';

export default function DocsPage() {
  return (
    <>
      <Header />
      <div className="h-[calc(100vh-56px)] flex">
        {/* 侧边栏导航 */}
        <div className="w-64 border-r border-gray-200 bg-transparent p-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wider">
              API Documentation
            </h3>
            <nav className="space-y-2">
              <a href="#public-apis" className="block text-sm text-gray-600 hover:text-purple-600 transition-colors duration-200 font-medium">
                Public APIs
              </a>
              <a href="#developer-apis" className="block text-sm text-gray-600 hover:text-purple-600 transition-colors duration-200 font-medium">
                Developer APIs
              </a>
              <a href="#admin-apis" className="block text-sm text-gray-600 hover:text-purple-600 transition-colors duration-200 font-medium">
                Admin APIs
              </a>
              <a href="#authentication" className="block text-sm text-gray-600 hover:text-purple-600 transition-colors duration-200 font-medium">
                Authentication
              </a>
              <a href="#data-structures" className="block text-sm text-gray-600 hover:text-purple-600 transition-colors duration-200 font-medium">
                Data Structures
              </a>
            </nav>
          </div>
        </div>

        {/* 主内容区域 */}
        <ScrollArea className="flex-1">
          <div className="p-8 max-w-4xl mx-auto">
            <div className="prose prose-gray max-w-none">
              <ReactMarkdown
                components={{
                  // 自定义标题样式
                  h1: ({ children }) => (
                    <h1 className="text-4xl font-bold mb-8 text-gray-900 border-b-2 border-black-200 pb-4">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-2xl font-semibold mt-10 mb-6 text-gray-800 border-l-4 border-purple-500 pl-4">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xl font-medium mt-8 mb-4 text-gray-700">
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="text-lg font-medium mt-6 mb-3 text-gray-600">
                      {children}
                    </h4>
                  ),
                  // 自定义代码块样式
                  code: ({ children, className }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-gray-100 text-gray-800 px-2 py-1 rounded-md text-sm font-mono border border-gray-200">
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
                    <pre className="bg-gray-900 text-gray-100 p-6 rounded-xl overflow-x-auto my-6 border border-gray-700 shadow-lg">
                      {children}
                    </pre>
                  ),
                  // 自定义表格样式
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-6 rounded-lg border border-gray-200 shadow-sm">
                      <table className="w-full border-collapse">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-gray-200 px-6 py-4 bg-gray-50 font-semibold text-left text-gray-700">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border-b border-gray-100 px-6 py-4 text-gray-600">
                      {children}
                    </td>
                  ),
                  // 自定义链接样式
                  a: ({ children, href }) => (
                    <a 
                      href={href} 
                      className="text-purple-600 hover:text-purple-700 underline underline-offset-2 transition-colors duration-200 font-medium"
                      target={href?.startsWith('http') ? '_blank' : undefined}
                      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      {children}
                    </a>
                  ),
                  // 自定义列表样式
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-2 my-6 text-gray-700">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-2 my-6 text-gray-700">
                      {children}
                    </ol>
                  ),
                  // 自定义引用样式
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-purple-500 bg-purple-50 pl-6 py-4 italic text-gray-700 my-6 rounded-r-lg">
                      {children}
                    </blockquote>
                  ),
                  // 自定义分隔线样式
                  hr: () => <Separator className="my-8 bg-gray-200" />,
                  // 自定义段落样式
                  p: ({ children }) => (
                    <p className="my-6 leading-relaxed text-gray-700">
                      {children}
                    </p>
                  ),
                  // 自定义列表项样式
                  li: ({ children }) => (
                    <li className="text-gray-700 leading-relaxed">
                      {children}
                    </li>
                  ),
                  // 自定义强调样式
                  strong: ({ children }) => (
                    <strong className="font-semibold text-gray-900">
                      {children}
                    </strong>
                  ),
                  // 自定义斜体样式
                  em: ({ children }) => (
                    <em className="italic text-gray-600">
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
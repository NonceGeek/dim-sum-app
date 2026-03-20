"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  BookOpen,
  Copy,
  Check,
  ArrowUp,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
// TODO: make apidoc.md load from api docs in backend to make it sync to the latest.
import readmeContentEn from "../../../../public/apidoc.en.md";
import readmeContentZhCN from "../../../../public/apidoc.zh-CN.md";

const readmeContentMap: Record<string, string> = {
  en: readmeContentEn,
  "zh-CN": readmeContentZhCN,
};

// --- Shared utility ---

const generateId = (text: string): string => {
  if (typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "") // Unicode-aware: keep letters, numbers, spaces, hyphens
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
};

// --- Navigation data (parsed from markdown) ---

type NavItem = {
  id: string;
  label: string;
  children: { id: string; label: string }[];
};

/** Skip the "Table of Contents" / "目录" section */
const TOC_HEADINGS = new Set(["table-of-contents", "目录"]);

function parseNavigation(markdown: string): NavItem[] {
  const items: NavItem[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);

    if (h2Match) {
      const label = h2Match[1].trim();
      const id = generateId(label);
      if (TOC_HEADINGS.has(id)) continue;
      items.push({ id, label, children: [] });
    } else if (h3Match && items.length > 0) {
      const label = h3Match[1].trim();
      const id = generateId(label);
      items[items.length - 1].children.push({ id, label });
    }
  }

  return items;
}

// --- Copy button component ---

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition-colors cursor-pointer"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

// --- Sidebar component ---

interface SidebarContentProps {
  navigationItems: NavItem[];
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
  handleAnchorClick: (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string
  ) => void;
  activeSection: string;
  tDocs: (key: string) => string;
}

function SidebarContent({
  navigationItems,
  expandedSections,
  toggleSection,
  handleAnchorClick,
  activeSection,
  tDocs,
}: SidebarContentProps) {
  return (
    <div className="space-y-4 h-full flex flex-col">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex-shrink-0">
        {tDocs("apiDocumentation")}
      </h3>
      <ScrollArea className="flex-1 min-h-0">
        <nav className="space-y-0.5 pr-4">
          {navigationItems.map((item) => {
            const isParentActive =
              activeSection === item.id ||
              item.children.some((c) => c.id === activeSection);

            return (
              <div key={item.id}>
                {/* Parent nav item */}
                <div
                  className={cn(
                    "flex items-center border-l-2 pl-2 -ml-[2px] transition-colors duration-200",
                    isParentActive ? "border-primary" : "border-transparent"
                  )}
                >
                  <a
                    href={`#${item.id}`}
                    className={cn(
                      "flex-1 text-sm transition-colors duration-200 font-medium cursor-pointer py-1.5",
                      activeSection === item.id
                        ? "text-primary"
                        : "text-muted-foreground hover:text-primary"
                    )}
                    onClick={(e) => handleAnchorClick(e, item.id)}
                  >
                    {item.label}
                  </a>
                  {item.children.length > 0 && (
                    <button
                      onClick={() => toggleSection(item.id)}
                      className="p-1.5 ml-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-all duration-200 flex items-center justify-center cursor-pointer"
                      title={
                        expandedSections.has(item.id)
                          ? tDocs("collapse")
                          : tDocs("expand")
                      }
                    >
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-300 ease-in-out",
                          expandedSections.has(item.id)
                            ? "rotate-90"
                            : "rotate-0"
                        )}
                      />
                    </button>
                  )}
                </div>

                {/* Children */}
                {item.children.length > 0 && (
                  <div
                    className="ml-4 border-l border-border pl-3 overflow-hidden transition-all duration-300 ease-out"
                    style={{
                      maxHeight: expandedSections.has(item.id)
                        ? `${item.children.length * 36 + 16}px`
                        : "0px",
                      opacity: expandedSections.has(item.id) ? 1 : 0,
                      marginTop: expandedSections.has(item.id) ? "4px" : "0px",
                      marginBottom: expandedSections.has(item.id)
                        ? "4px"
                        : "0px",
                    }}
                  >
                    <div className="space-y-0.5 py-1">
                      {item.children.map((child, index) => (
                        <a
                          key={child.id}
                          href={`#${child.id}`}
                          className={cn(
                            "block text-xs cursor-pointer py-1 px-2 rounded-sm transition-colors duration-150",
                            activeSection === child.id
                              ? "text-primary bg-primary/10 font-medium"
                              : "text-muted-foreground hover:text-primary hover:bg-primary/10",
                            expandedSections.has(item.id)
                              ? "translate-x-0 opacity-100"
                              : "translate-x-2 opacity-0"
                          )}
                          style={{
                            transitionProperty: "transform, opacity, color, background-color",
                            transitionDuration: "200ms",
                            transitionDelay: expandedSections.has(item.id)
                              ? `${index * 30}ms`
                              : "0ms",
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
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}

// --- HTTP Method badge colors ---

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  POST: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  PUT: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  DELETE:
    "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  PATCH:
    "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
};

// --- Syntax highlighting helpers ---

function highlightJson(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(
      /("(?:[^"\\]|\\.)*")(\s*:)/g,
      '<span style="color:#c792ea">$1</span>$2'
    ) // keys
    .replace(
      /:\s*("(?:[^"\\]|\\.)*")/g,
      ': <span style="color:#c3e88d">$1</span>'
    ) // string values
    .replace(
      /:\s*(true|false)/g,
      ': <span style="color:#ffcb6b">$1</span>'
    ) // booleans
    .replace(
      /:\s*(\d+\.?\d*)/g,
      ': <span style="color:#f78c6c">$1</span>'
    ) // numbers
    .replace(
      /:\s*(null)/g,
      ': <span style="color:#676e95">$1</span>'
    ); // null
}

function highlightBash(text: string): string {
  // Tokenize first, then colorize — avoids regex conflicts
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  // Split on quoted strings first to protect them
  const parts = escaped.split(/("(?:[^"\\]|\\.)*")/g);

  return parts
    .map((part, i) => {
      // Odd indices are quoted strings
      if (i % 2 === 1) {
        return `<span style="color:#c3e88d">${part}</span>`;
      }
      // Even indices are non-string parts — highlight commands and flags
      return part
        .replace(
          /\b(curl)\b/g,
          '<span style="color:#82aaff">$1</span>'
        )
        .replace(
          /(\s)(-[A-Za-z]+)/g,
          '$1<span style="color:#ffcb6b">$2</span>'
        )
        .replace(
          /(\\)(\s*\n|$)/g,
          '<span style="color:#676e95">$1</span>$2'
        );
    })
    .join("");
}

// ============================================================================
// Main component
// ============================================================================

export default function DocsPage() {
  const locale = useLocale();
  const tDocs = useTranslations("Docs");
  const readmeContent = readmeContentMap[locale] || readmeContentMap["en"];
  const navigationItems = useMemo(
    () => parseNavigation(readmeContent),
    [readmeContent]
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [activeSection, setActiveSection] = useState<string>("");
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Handle URL anchor on page load
  useEffect(() => {
    const handleInitialAnchor = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        setTimeout(() => {
          const targetElement = document.getElementById(hash);
          if (targetElement) {
            targetElement.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }, 100);
      }
    };

    handleInitialAnchor();
    window.addEventListener("hashchange", handleInitialAnchor);
    return () => window.removeEventListener("hashchange", handleInitialAnchor);
  }, []);

  // Scroll spy — track which heading is nearest the top of the content area
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const updateActiveSection = () => {
      const headings = container.querySelectorAll("h2[id], h3[id]");
      if (headings.length === 0) return;

      let closest: Element | null = null;
      let closestDistance = Infinity;

      for (const heading of headings) {
        const rect = heading.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;

        // Find heading closest to top of container (within top 40%)
        if (
          relativeTop <= containerRect.height * 0.4 &&
          relativeTop > -rect.height
        ) {
          const distance = Math.abs(relativeTop);
          if (distance < closestDistance) {
            closestDistance = distance;
            closest = heading;
          }
        }
      }

      if (closest) {
        setActiveSection(closest.id);
      }
    };

    container.addEventListener("scroll", updateActiveSection, {
      passive: true,
    });
    // Run once on mount after markdown renders
    const timer = setTimeout(updateActiveSection, 300);

    return () => {
      container.removeEventListener("scroll", updateActiveSection);
      clearTimeout(timer);
    };
  }, [readmeContent]);

  // Auto-expand sidebar section when scroll spy activates a child
  useEffect(() => {
    if (!activeSection) return;
    const parentItem = navigationItems.find(
      (item) =>
        item.id === activeSection ||
        item.children.some((c) => c.id === activeSection)
    );
    if (
      parentItem &&
      parentItem.children.length > 0 &&
      !expandedSections.has(parentItem.id)
    ) {
      setExpandedSections((prev) => new Set([...prev, parentItem.id]));
    }
  }, [activeSection, expandedSections]);

  // Back to top visibility — listen on content area scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handleScroll = () => {
      setShowBackToTop(container.scrollTop > 400);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  const handleAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
      e.preventDefault();
      window.history.pushState(null, "", `#${targetId}`);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    []
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full">
      {/* Desktop sidebar — normal flex child, no fixed/sticky needed */}
      <div className="hidden md:flex w-64 border-r border-border bg-background/50 flex-shrink-0 overflow-hidden">
        <div className="p-6 h-full w-full">
          <SidebarContent
            navigationItems={navigationItems}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            handleAnchorClick={handleAnchorClick}
            activeSection={activeSection}
            tDocs={tDocs}
          />
        </div>
      </div>

      {/* Main content — independently scrollable */}
      <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto relative">
        {/* Mobile nav bar */}
        <div className="md:hidden sticky top-0 left-0 right-0 z-40 backdrop-blur-md border-b border-border bg-background/90">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-2 min-w-0">
              <BookOpen className="h-5 w-5 text-primary flex-shrink-0" />
              <h2 className="text-lg font-semibold text-foreground truncate">
                {tDocs("apiDocumentation")}
              </h2>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-1 flex-shrink-0"
                >
                  <span className="text-sm">{tDocs("sections")}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 max-h-96 overflow-y-auto bg-popover backdrop-blur-md border border-border shadow-lg"
              >
                {navigationItems.map((item) => (
                  <div key={item.id}>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        handleAnchorClick(
                          e as unknown as React.MouseEvent<HTMLAnchorElement>,
                          item.id
                        );
                      }}
                      className="cursor-pointer text-foreground hover:text-primary font-medium"
                    >
                      {item.label}
                    </DropdownMenuItem>
                    {item.children.length > 0 && (
                      <div className="ml-4 border-l-2 border-border">
                        {item.children.map((child) => (
                          <DropdownMenuItem
                            key={child.id}
                            onClick={(e) => {
                              e.preventDefault();
                              handleAnchorClick(
                                e as unknown as React.MouseEvent<HTMLAnchorElement>,
                                child.id
                              );
                            }}
                            className="cursor-pointer text-xs text-muted-foreground hover:text-primary pl-3"
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

        {/* Content */}
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
          <div className="prose prose-gray max-w-none prose-sm md:prose-base">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl md:text-4xl font-bold mb-6 md:mb-8 text-foreground border-b-2 border-border pb-3 md:pb-4 break-words">
                    {children}
                  </h1>
                ),
                h2: ({ children, id }) => {
                  const headingId =
                    id || generateId(children as string);
                  return (
                    <h2
                      id={headingId}
                      className="text-xl md:text-2xl font-semibold mt-10 md:mt-12 mb-4 md:mb-6 text-foreground border-l-4 border-primary pl-3 md:pl-4 scroll-mt-20 break-words"
                    >
                      {children}
                    </h2>
                  );
                },
                h3: ({ children, id }) => {
                  const headingId =
                    id || generateId(children as string);
                  return (
                    <h3
                      id={headingId}
                      className="text-lg md:text-xl font-medium mt-10 md:mt-12 mb-3 md:mb-4 pt-6 md:pt-8 text-foreground scroll-mt-20 break-words border-t border-border first:border-t-0 first:pt-0 first:mt-6"
                    >
                      {children}
                    </h3>
                  );
                },
                h4: ({ children }) => (
                  <h4 className="text-base md:text-lg font-medium mt-4 md:mt-6 mb-2 md:mb-3 text-muted-foreground break-words">
                    {children}
                  </h4>
                ),

                // Inline code only — block code is handled in `pre`
                code: ({ children, className }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="bg-muted text-foreground px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs md:text-sm font-mono border border-border break-words">
                        {children}
                      </code>
                    );
                  }
                  // Block code: just pass through, pre handles everything
                  return <code className="font-mono">{children}</code>;
                },

                pre: ({ children }) => {
                  // Extract language and raw text from code child
                  let language = "";
                  let rawText = "";

                  React.Children.forEach(children, (child) => {
                    if (React.isValidElement(child) && child.props) {
                      const codeClassName =
                        (child.props as Record<string, unknown>).className || "";
                      const match =
                        typeof codeClassName === "string"
                          ? codeClassName.match(/language-(\w+)/)
                          : null;
                      if (match) language = match[1];

                      const codeChildren = (child.props as Record<string, unknown>).children;
                      if (typeof codeChildren === "string") {
                        rawText = codeChildren;
                      }
                    }
                  });

                  const langLabel =
                    language === "json"
                      ? "JSON"
                      : language === "bash"
                        ? "Shell"
                        : language
                          ? language.toUpperCase()
                          : "";

                  // Apply syntax highlighting if we have raw text
                  let highlightedHtml = "";
                  if (rawText) {
                    if (language === "json") {
                      highlightedHtml = highlightJson(rawText);
                    } else if (language === "bash") {
                      highlightedHtml = highlightBash(rawText);
                    }
                  }

                  return (
                    <div className="relative group my-4 md:my-6 rounded-lg overflow-hidden border border-neutral-700/50">
                      {/* Header bar */}
                      <div className="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700/50">
                        <span className="text-xs font-mono text-neutral-400">
                          {langLabel}
                        </span>
                        <CopyButton text={rawText} />
                      </div>
                      {/* Code content */}
                      {highlightedHtml ? (
                        <pre className="bg-neutral-900 text-neutral-200 p-4 md:p-5 overflow-x-auto text-xs md:text-sm font-mono leading-relaxed whitespace-pre-wrap break-words m-0 rounded-none border-0">
                          <code
                            className="font-mono"
                            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                          />
                        </pre>
                      ) : (
                        <pre className="bg-neutral-900 text-neutral-200 p-4 md:p-5 overflow-x-auto text-xs md:text-sm font-mono leading-relaxed whitespace-pre-wrap break-words m-0 rounded-none border-0">
                          {children}
                        </pre>
                      )}
                    </div>
                  );
                },

                // HTTP Method badges
                p: ({ children }) => {
                  const childArray = React.Children.toArray(children);

                  // Detect: <strong>GET</strong> <code>/path</code>
                  if (childArray.length >= 2) {
                    const first = childArray[0];
                    if (React.isValidElement(first)) {
                      const firstProps = first.props as Record<string, unknown>;
                      const text =
                        typeof firstProps?.children === "string"
                          ? firstProps.children.trim()
                          : "";

                      if (METHOD_COLORS[text]) {
                        return (
                          <div className="flex items-center gap-3 my-4 md:my-5">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-bold font-mono tracking-wider min-w-[4rem]",
                                METHOD_COLORS[text]
                              )}
                            >
                              {text}
                            </span>
                            <span className="text-base md:text-lg font-mono font-medium text-foreground">
                              {childArray.slice(1)}
                            </span>
                          </div>
                        );
                      }
                    }
                  }

                  return (
                    <p className="my-3 md:my-4 leading-relaxed text-foreground text-sm md:text-base break-words">
                      {children}
                    </p>
                  );
                },

                table: ({ children }) => (
                  <div className="overflow-x-auto my-4 md:my-6 rounded-lg border border-border shadow-sm">
                    <table className="w-full border-collapse min-w-full">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border-b border-border px-3 md:px-6 py-2 md:py-4 bg-muted font-semibold text-left text-foreground text-xs md:text-sm break-words">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-b border-border px-3 md:px-6 py-2 md:py-4 text-muted-foreground text-xs md:text-sm break-words">
                    {children}
                  </td>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors duration-200 font-medium inline-flex items-center gap-1 text-sm md:text-base break-words"
                    target={
                      href?.startsWith("http") ? "_blank" : undefined
                    }
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
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 md:space-y-2 my-3 md:my-4 text-foreground text-sm md:text-base">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 md:space-y-2 my-3 md:my-4 text-foreground text-sm md:text-base">
                    {children}
                  </ol>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary bg-primary/10 pl-4 md:pl-6 py-3 md:py-4 italic text-foreground my-4 md:my-6 rounded-r-lg text-sm md:text-base break-words">
                    {children}
                  </blockquote>
                ),
                // hr between endpoints: now just spacing since h3 has border-t
                hr: () => <div className="my-2" />,
                li: ({ children }) => (
                  <li className="text-foreground leading-relaxed text-sm md:text-base break-words">
                    {children}
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground text-sm md:text-base break-words">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-muted-foreground text-sm md:text-base break-words">
                    {children}
                  </em>
                ),
              }}
            >
              {readmeContent}
            </ReactMarkdown>
          </div>
        </div>

        {/* Back to top */}
        {showBackToTop && (
          <button
            onClick={() =>
              contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })
            }
            className="sticky bottom-6 float-right mr-6 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-200 hover:scale-105 cursor-pointer"
            title="Back to top"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

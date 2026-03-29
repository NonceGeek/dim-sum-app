# API Docs Page Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the `/docs` API documentation page from a raw markdown wall into a polished, professional developer experience with syntax highlighting, copy buttons, method badges, scroll spy, and layout fixes.

**Architecture:** Keep markdown files as content source. Enhance entirely through ReactMarkdown custom renderers and surrounding component improvements. No new dependencies required — pure CSS highlighting, clipboard API for copy, IntersectionObserver for scroll spy.

**Tech Stack:** Next.js 16, React 19, ReactMarkdown, Tailwind CSS 4, motion@12.6.3, existing design token system

---

### Task 1: Extract `generateId` and fix Chinese character support

**Files:**
- Modify: `app/[locale]/(home)/docs/page.tsx:349-378`

**Step 1: Extract `generateId` to top-level and fix regex**

Move the duplicated function out of the h2/h3 renderers to the top of the file (before the component), and fix the regex to support Chinese/Unicode characters:

```tsx
// Place after imports, before component
const generateId = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // Unicode-aware: keep letters, numbers, spaces, hyphens
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};
```

**Step 2: Update h2 and h3 renderers to use the shared function**

Remove the inline `generateId` definitions from both h2 (lines 349-356) and h3 (lines 371-378) renderers. They already reference `generateId` so just deleting the inner definitions is sufficient.

**Step 3: Verify the page still renders**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm dev`
Open: `http://localhost:2222/zh-CN/docs`
Expected: Page renders without errors, Chinese heading anchors now work correctly.

**Step 4: Commit**

```bash
git add app/[locale]/(home)/docs/page.tsx
git commit -m "fix: extract generateId and support Chinese characters in anchor IDs"
```

---

### Task 2: Extract SidebarContent to a standalone component

**Files:**
- Modify: `app/[locale]/(home)/docs/page.tsx`

**Step 1: Convert SidebarContent from inline arrow function to a proper component**

The current `SidebarContent` is defined inside `DocsPage` as `const SidebarContent = () => (...)` which causes re-mount on every parent render. Refactor it to receive props:

```tsx
// Place before DocsPage component
interface SidebarContentProps {
  navigationItems: Array<{
    id: string;
    label: string;
    children: Array<{ id: string; label: string }>;
  }>;
  expandedSections: Set<string>;
  toggleSection: (id: string) => void;
  handleAnchorClick: (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => void;
  activeSection: string; // Will be used in Task 5
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
      {/* ... existing sidebar JSX, unchanged ... */}
    </div>
  );
}
```

**Step 2: Update DocsPage to pass props**

Replace `<SidebarContent />` calls with `<SidebarContent navigationItems={navigationItems} expandedSections={expandedSections} ... />`. Add `activeSection` state (initialize as `''`, will be wired in Task 5).

**Step 3: Verify sidebar still works**

Open: `http://localhost:2222/zh-CN/docs`
Expected: Sidebar renders, expand/collapse works, anchor clicks work.

**Step 4: Commit**

```bash
git add app/[locale]/(home)/docs/page.tsx
git commit -m "refactor: extract SidebarContent to standalone component"
```

---

### Task 3: Fix layout — sidebar height, mobile dark mode

**Files:**
- Modify: `app/[locale]/(home)/docs/page.tsx:267-336`

**Step 1: Fix desktop sidebar positioning**

The parent layout uses `flex-1 overflow-y-auto` which already handles scrolling. The sidebar needs `sticky` positioning relative to the scroll container. Change the sidebar wrapper (line 269):

From:
```tsx
<div className="hidden md:block w-64 border-r border-border bg-transparent flex-shrink-0 h-screen overflow-hidden">
```

To:
```tsx
<div className="hidden md:block w-64 border-r border-border bg-background/50 flex-shrink-0 sticky top-0 self-start h-[calc(100vh-3.5rem)] overflow-hidden">
```

Key changes:
- `sticky top-0 self-start` — stays fixed while content scrolls
- `h-[calc(100vh-3.5rem)]` — accounts for the 3.5rem (h-14) header
- `bg-background/50` — subtle background using theme token instead of transparent

**Step 2: Fix mobile gradient for dark mode**

Change line 278 from hardcoded gradient:
```tsx
bg-[linear-gradient(135deg,_#b2c7ff_0%,_#d7d7fe_100%)]
```

To theme-aware:
```tsx
bg-background/90 backdrop-blur-md
```

Same fix for DropdownMenuContent at line 299 — replace the hardcoded gradient with:
```tsx
bg-popover backdrop-blur-md
```

**Step 3: Fix main content ScrollArea**

The parent layout already provides `overflow-y-auto`. The inner `ScrollArea` with `h-screen` creates a nested scroll container which fights with the layout. Change line 336:

From:
```tsx
<ScrollArea className="h-screen pt-6">
```

To:
```tsx
<div className="pt-6">
```

And change the closing `</ScrollArea>` (line 510) to `</div>`.

**Step 4: Verify layout**

Open: `http://localhost:2222/zh-CN/docs`
- Desktop: Sidebar should stay visible while scrolling content
- Toggle dark mode: Mobile nav bar should match theme
- Scroll should be smooth with no double-scrollbar

**Step 5: Commit**

```bash
git add app/[locale]/(home)/docs/page.tsx
git commit -m "fix: sidebar height accounting for header, dark mode mobile nav"
```

---

### Task 4: HTTP Method Badges in paragraph renderer

**Files:**
- Modify: `app/[locale]/(home)/docs/page.tsx` — the `p` renderer (line 481) and imports

**Step 1: Add method badge detection to the `p` renderer**

The markdown has patterns like: `**GET** \`/path\`` which ReactMarkdown renders as `<p><strong>GET</strong> <code>/path</code></p>`.

Replace the `p` renderer:

```tsx
p: ({ children }) => {
  // Detect HTTP method pattern: <strong>GET</strong> <code>/path</code>
  const childArray = React.Children.toArray(children);

  // Check if first child is a <strong> with an HTTP method
  if (childArray.length >= 2) {
    const firstChild = childArray[0];
    if (
      React.isValidElement(firstChild) &&
      firstChild.props?.['data-slot'] === 'strong-text'
    ) {
      const method = typeof firstChild.props.children === 'string'
        ? firstChild.props.children.trim()
        : '';

      const methodColors: Record<string, string> = {
        'GET': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
        'POST': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
        'PUT': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
        'DELETE': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
        'PATCH': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800',
      };

      if (methodColors[method]) {
        return (
          <div className="flex items-center gap-3 my-4 md:my-5">
            <span className={cn(
              "inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-bold font-mono tracking-wider min-w-[4rem]",
              methodColors[method]
            )}>
              {method}
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
```

**Step 2: Update the `strong` renderer to add a data attribute**

We need a way to detect `<strong>` elements in the `p` renderer. Add a `data-slot` attribute:

```tsx
strong: ({ children }) => (
  <strong data-slot="strong-text" className="font-semibold text-foreground text-sm md:text-base break-words">
    {children}
  </strong>
),
```

**Step 3: Alternative approach if data-slot detection doesn't work with ReactMarkdown**

ReactMarkdown may strip custom attributes. If so, use string-based detection instead:

```tsx
p: ({ children }) => {
  const childArray = React.Children.toArray(children);

  if (childArray.length >= 2) {
    const first = childArray[0];
    // ReactMarkdown renders **GET** as <strong>GET</strong>
    if (React.isValidElement(first) && first.type === 'strong') {
      // Won't work because we override strong. Check for our component:
    }
    // More reliable: check the rendered strong component
    if (
      React.isValidElement(first) &&
      typeof first.props?.children === 'string'
    ) {
      const text = first.props.children.trim();
      const methodColors: Record<string, string> = {
        'GET': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
        'POST': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
        'PUT': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
        'DELETE': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
        'PATCH': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800',
      };

      if (methodColors[text]) {
        return (
          <div className="flex items-center gap-3 my-4 md:my-5">
            <span className={cn(
              "inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-bold font-mono tracking-wider min-w-[4rem]",
              methodColors[text]
            )}>
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
```

**Important**: Test this in the browser — inspect the actual React element tree to see what ReactMarkdown produces for `**GET** \`/path\``. Adjust the detection logic based on what you find. The key is: check `childArray[0]`, see if it looks like an HTTP method, and if so render a colored badge.

**Step 4: Verify badges render**

Open: `http://localhost:2222/zh-CN/docs`
Expected: Each endpoint shows a colored GET/POST badge followed by the path in monospace.

**Step 5: Commit**

```bash
git add app/[locale]/(home)/docs/page.tsx
git commit -m "feat: add colored HTTP method badges to API endpoints"
```

---

### Task 5: Code block enhancement — copy button, language label, dark background

**Files:**
- Modify: `app/[locale]/(home)/docs/page.tsx` — the `pre` and `code` renderers

**Step 1: Create a CodeBlock wrapper with copy button**

Replace the `pre` renderer with a component that extracts the language and code text, then renders a header bar + copy button:

```tsx
pre: ({ children }) => {
  // Extract language and raw text from the code child
  let language = '';
  let rawText = '';

  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.props) {
      const className = child.props.className || '';
      const match = className.match(/language-(\w+)/);
      if (match) language = match[1];

      // Extract text content
      const codeChildren = child.props.children;
      if (typeof codeChildren === 'string') {
        rawText = codeChildren;
      }
    }
  });

  const langLabel = language === 'json' ? 'JSON'
    : language === 'bash' ? 'Shell'
    : language ? language.toUpperCase()
    : 'Code';

  return (
    <div className="relative group my-4 md:my-6 rounded-lg overflow-hidden border border-neutral-700">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700">
        <span className="text-xs font-mono text-neutral-400">{langLabel}</span>
        <CopyButton text={rawText} />
      </div>
      {/* Code content */}
      <pre className="bg-neutral-900 text-neutral-100 p-4 md:p-5 overflow-x-auto text-xs md:text-sm font-mono leading-relaxed whitespace-pre-wrap break-words">
        {children}
      </pre>
    </div>
  );
},
```

**Step 2: Create the CopyButton component**

Add this above the `DocsPage` component:

```tsx
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition-colors"
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
```

**Step 3: Add imports**

Add `Copy, Check` to the lucide-react import:

```tsx
import { ChevronDown, ChevronRight, BookOpen, Copy, Check } from "lucide-react";
```

**Step 4: Update the `code` block renderer for basic JSON highlighting**

For block code (when `className` exists), add simple regex-based highlighting:

```tsx
code: ({ children, className }) => {
  const isInline = !className;
  if (isInline) {
    return (
      <code className="bg-muted text-foreground px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs md:text-sm font-mono border border-border break-words">
        {children}
      </code>
    );
  }

  // Block code with basic syntax highlighting
  const language = className?.match(/language-(\w+)/)?.[1] || '';
  const text = typeof children === 'string' ? children : '';

  if (language === 'json' && text) {
    const highlighted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="text-purple-400">$1</span>$2') // keys
      .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="text-green-400">$1</span>') // string values
      .replace(/:\s*(true|false)/g, ': <span class="text-amber-400">$1</span>') // booleans
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="text-cyan-400">$1</span>') // numbers
      .replace(/:\s*(null)/g, ': <span class="text-neutral-500">$1</span>'); // null

    return (
      <code
        className="font-mono"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  }

  if (language === 'bash' && text) {
    const highlighted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/(curl|GET|POST|PUT|DELETE|PATCH)/g, '<span class="text-cyan-400">$1</span>')
      .replace(/(-[A-Za-z]+)/g, '<span class="text-amber-400">$1</span>')
      .replace(/("(?:[^"\\]|\\.)*")/g, '<span class="text-green-400">$1</span>')
      .replace(/(https?:\/\/[^\s"]+)/g, '<span class="text-blue-400">$1</span>');

    return (
      <code
        className="font-mono"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    );
  }

  return <code className={cn("font-mono", className)}>{children}</code>;
},
```

**Step 5: Verify code blocks**

Open: `http://localhost:2222/zh-CN/docs`
Expected:
- All code blocks have dark background
- JSON blocks show colored keys/values
- Bash blocks show colored commands/flags
- Copy button appears in header, clicking it copies text and shows "Copied!"

**Step 6: Commit**

```bash
git add app/[locale]/(home)/docs/page.tsx
git commit -m "feat: add code block copy button, language label, syntax highlighting"
```

---

### Task 6: Sidebar scroll spy with IntersectionObserver

**Files:**
- Modify: `app/[locale]/(home)/docs/page.tsx`

**Step 1: Add activeSection state and IntersectionObserver**

Add a new `useState` and `useEffect` inside `DocsPage`:

```tsx
const [activeSection, setActiveSection] = useState<string>('');

useEffect(() => {
  const headings = document.querySelectorAll('h2[id], h3[id]');
  if (headings.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      // Find the first heading that is intersecting
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length > 0) {
        setActiveSection(visible[0].target.id);
      }
    },
    {
      rootMargin: '-80px 0px -60% 0px', // top offset for header, bottom bias toward top of viewport
      threshold: 0,
    }
  );

  headings.forEach((heading) => observer.observe(heading));

  return () => observer.disconnect();
}, [readmeContent]); // Re-observe when content changes (locale switch)
```

**Step 2: Auto-expand parent section when child becomes active**

Add another effect that watches `activeSection`:

```tsx
useEffect(() => {
  if (!activeSection) return;

  // Find which parent section contains this activeSection
  const parentItem = navigationItems.find(
    (item) => item.id === activeSection || item.children.some((c) => c.id === activeSection)
  );

  if (parentItem && parentItem.children.length > 0 && !expandedSections.has(parentItem.id)) {
    setExpandedSections((prev) => new Set([...prev, parentItem.id]));
  }
}, [activeSection]);
```

**Step 3: Pass `activeSection` to SidebarContent and apply active styles**

In the `SidebarContent` component, update the nav link styling to highlight the active item:

For parent items (the `<a>` element):
```tsx
className={cn(
  "flex-1 text-sm transition-colors duration-200 font-medium cursor-pointer py-1",
  activeSection === item.id
    ? "text-primary font-semibold"
    : "text-muted-foreground hover:text-primary"
)}
```

For child items:
```tsx
className={cn(
  "block text-xs cursor-pointer py-1 px-2 rounded-sm transition-colors duration-150",
  activeSection === child.id
    ? "text-primary bg-primary/10 font-medium"
    : "text-muted-foreground hover:text-primary hover:translate-x-1 hover:bg-primary/10",
  expandedSections.has(item.id)
    ? 'translate-x-0 opacity-100'
    : 'translate-x-2 opacity-0'
)}
```

Add a left border indicator on the parent `<nav>` level — wrap each parent item's link area:

```tsx
<div className={cn(
  "flex items-center border-l-2 pl-2 -ml-[2px] transition-colors duration-200",
  activeSection === item.id || item.children.some(c => c.id === activeSection)
    ? "border-primary"
    : "border-transparent"
)}>
```

**Step 4: Verify scroll spy**

Open: `http://localhost:2222/zh-CN/docs`
- Scroll down through the document
- Expected: Current section highlights in sidebar, parent auto-expands
- Click sidebar links: should still scroll smoothly

**Step 5: Commit**

```bash
git add app/[locale]/(home)/docs/page.tsx
git commit -m "feat: add sidebar scroll spy with IntersectionObserver"
```

---

### Task 7: Visual polish — endpoint separation, spacing, back-to-top

**Files:**
- Modify: `app/[locale]/(home)/docs/page.tsx`

**Step 1: Add visual separator to h3 (endpoint titles)**

Update the h3 renderer to add a top border and more spacing between endpoints:

```tsx
h3: ({ children, id }) => {
  const headingId = id || generateId(children as string);
  return (
    <h3
      id={headingId}
      className="text-lg md:text-xl font-medium mt-10 md:mt-12 mb-3 md:mb-4 pt-6 md:pt-8 text-foreground scroll-mt-20 md:scroll-mt-20 break-words border-t border-border"
    >
      {children}
    </h3>
  );
},
```

Key changes: `mt-10 md:mt-12` (was `mt-6 md:mt-8`), added `pt-6 md:pt-8 border-t border-border` to visually separate endpoints.

**Step 2: Tighten paragraph spacing**

Already done in Task 4 — the `p` renderer uses `my-3 md:my-4` (was `my-4 md:my-6`).

**Step 3: Add "Back to Top" button**

Add a floating button at the bottom of the page component, inside the main content `div` (before the closing `</div>` of the flex container):

```tsx
// Add state for visibility
const [showBackToTop, setShowBackToTop] = useState(false);

// Add scroll listener in useEffect
useEffect(() => {
  const scrollContainer = document.querySelector('[data-docs-scroll]');
  if (!scrollContainer) return;

  const handleScroll = () => {
    setShowBackToTop(scrollContainer.scrollTop > 400);
  };

  scrollContainer.addEventListener('scroll', handleScroll);
  return () => scrollContainer.removeEventListener('scroll', handleScroll);
}, []);
```

Add `data-docs-scroll` to the parent layout's scroll container. Since we changed ScrollArea to a `<div>` in Task 3, the scroll happens on the layout's `overflow-y-auto` div. We can detect scroll on `window` instead:

```tsx
useEffect(() => {
  const handleScroll = () => {
    setShowBackToTop(window.scrollY > 400);
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

Button JSX (add right before the closing `</div>` of the flex root):

```tsx
{/* Back to top button */}
{showBackToTop && (
  <button
    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-200 hover:scale-105"
    title="Back to top"
  >
    <ArrowUp className="h-5 w-5" />
  </button>
)}
```

Add `ArrowUp` to lucide-react imports:

```tsx
import { ChevronDown, ChevronRight, BookOpen, Copy, Check, ArrowUp } from "lucide-react";
```

**Step 4: Improve the `hr` separator styling**

The current `---` between endpoints renders as a Separator. Since we added border-top to h3, the hr between endpoints becomes redundant/double. Make it subtler:

```tsx
hr: () => <div className="my-2" />,
```

This replaces the visible line with just spacing, since h3 now has its own border.

**Step 5: Verify visual improvements**

Open: `http://localhost:2222/zh-CN/docs`
Expected:
- Clear visual separation between each API endpoint
- Content feels less "wall of text"
- Back to top button appears after scrolling down, smooth scrolls to top

**Step 6: Commit**

```bash
git add app/[locale]/(home)/docs/page.tsx
git commit -m "feat: add endpoint visual separation and back-to-top button"
```

---

### Task 8: Remove unused imports and clean up

**Files:**
- Modify: `app/[locale]/(home)/docs/page.tsx`

**Step 1: Audit imports**

After all changes, verify which imports are actually used. Remove any that are not:
- `Card`, `CardContent` — if still unused, remove
- `Badge` — if still unused (we used `cn` + raw className instead), remove
- `Separator` — if hr now uses a plain div, remove
- `ScrollArea` — if replaced with plain div, remove the import
- `BookOpen` — check if still used in mobile nav

**Step 2: Verify no console errors**

Open: `http://localhost:2222/zh-CN/docs`
Open browser DevTools console
Expected: No errors, no unused import warnings

**Step 3: Test mobile responsive**

Resize browser to mobile width (~375px)
Expected:
- Mobile nav dropdown works
- Code blocks don't overflow
- Method badges stack appropriately
- Back to top button is accessible

**Step 4: Test dark mode**

Toggle dark mode
Expected:
- Code blocks still have dark background (always dark)
- Method badges adapt colors
- Sidebar looks good
- No hardcoded color artifacts

**Step 5: Final commit**

```bash
git add app/[locale]/(home)/docs/page.tsx
git commit -m "chore: clean up unused imports and finalize docs page optimization"
```

---

## Summary of All Changes

| Task | What | Impact |
|------|------|--------|
| 1 | Fix `generateId` — deduplicate + Chinese support | Bug fix |
| 2 | Extract `SidebarContent` component | Performance |
| 3 | Fix layout — sidebar height, dark mode mobile | Layout fix |
| 4 | HTTP Method colored badges | Visual upgrade |
| 5 | Code block copy + highlighting + dark bg | Core feature |
| 6 | Sidebar scroll spy | Navigation UX |
| 7 | Endpoint separation + back-to-top | Visual polish |
| 8 | Clean up unused imports | Hygiene |

**No new dependencies required.** All changes are within the single `page.tsx` file.

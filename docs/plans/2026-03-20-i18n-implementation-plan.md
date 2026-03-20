# i18n 多语言 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Simplified Chinese (zh-CN) and English (en) internationalization to dimsum-app using next-intl, with URL prefix routing and progressive migration.

**Architecture:** All pages move under `app/[locale]/` dynamic segment. next-intl handles locale routing via `proxy.ts` (Next.js 16 renamed middleware to proxy). The existing next-auth logic in `middleware.ts` merges into the new `proxy.ts`. Translation files live in `messages/` with namespace-based organization.

**Tech Stack:** next-intl v4, Next.js 16.1.7, App Router, TypeScript

**Important Next.js 16 change:** `middleware.ts` has been renamed to `proxy.ts`. The export function is now `proxy()` instead of `middleware()`.

---

### Task 1: Install next-intl and create i18n configuration

**Files:**
- Modify: `main/package.json`
- Create: `main/i18n/routing.ts`
- Create: `main/i18n/request.ts`
- Create: `main/i18n/navigation.ts`

**Step 1: Install next-intl**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm add next-intl`

**Step 2: Create routing config**

Create `main/i18n/routing.ts`:
```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['zh-CN', 'en'],
  defaultLocale: 'zh-CN',
});
```

**Step 3: Create request config**

Create `main/i18n/request.ts`:
```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { hasLocale } from 'next-intl';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

**Step 4: Create navigation utilities**

Create `main/i18n/navigation.ts`:
```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

**Step 5: Commit**

```bash
git add i18n/ package.json pnpm-lock.yaml
git commit -m "feat(i18n): install next-intl and create i18n configuration"
```

---

### Task 2: Create translation files

**Files:**
- Create: `main/messages/zh-CN.json`
- Create: `main/messages/en.json`

**Step 1: Create Chinese translation file**

Create `main/messages/zh-CN.json`:
```json
{
  "Common": {
    "signIn": "登录",
    "signOut": "退出登录",
    "cancel": "取消",
    "confirm": "确认",
    "search": "搜索",
    "create": "创建",
    "edit": "编辑",
    "delete": "删除",
    "save": "保存",
    "loading": "加载中...",
    "noData": "暂无数据",
    "back": "返回"
  },
  "Nav": {
    "home": "首页",
    "library": "语料库",
    "appStore": "应用商店",
    "docs": "文档",
    "myAccount": "我的账户",
    "myRecord": "我的记录",
    "dataAnnotation": "数据标注",
    "api": "API",
    "admin": "管理后台",
    "settings": "设置",
    "learning": "学习",
    "gaming": "游戏",
    "ai": "AI",
    "others": "其他"
  },
  "Auth": {
    "selectRole": "选择你的角色",
    "selectRoleDesc": "请选择你的角色以继续",
    "learner": "学习者",
    "tagger": "标注员",
    "researcher": "研究者",
    "signInWith": "使用 {provider} 登录",
    "orContinueWith": "或者使用",
    "termsOfService": "服务条款",
    "privacyPolicy": "隐私政策"
  },
  "Home": {
    "globalSearch": "全局搜索",
    "trending": "热搜",
    "searchPlaceholder": "搜索粤语内容..."
  },
  "Library": {
    "title": "粤语语料集",
    "selectTag": "选择一个标签",
    "classic": "经典",
    "dictionary": "字典",
    "importing": "入库中",
    "rawCorpus": "生语料",
    "size": "大小"
  },
  "AppStore": {
    "launch": "启动应用",
    "launchIntl": "启动应用（国际版）",
    "appHome": "应用主页"
  },
  "DataAnnotation": {
    "title": "数据标注",
    "batchUpload": "批量上传",
    "downloadTemplate": "下载模板",
    "character": "字符",
    "category": "分类",
    "pronunciation": "粤音",
    "wordGroup": "组词",
    "sentence": "句子",
    "reference": "相关文献",
    "videoClip": "视频切片",
    "notEditable": "此条目不可编辑"
  },
  "Profile": {
    "title": "个人资料",
    "editProfile": "编辑资料",
    "systemAdmin": "系统管理员",
    "bind": "绑定",
    "unbind": "解绑",
    "change": "更改",
    "notSet": "未设置",
    "noWallet": "未绑定钱包",
    "updateSuccess": "资料更新成功",
    "updateFailed": "资料更新失败"
  },
  "Validation": {
    "enterCharacter": "请输入字符",
    "atLeastOnePronunciation": "请至少输入一个粤音",
    "selectFile": "请先选择文件",
    "enterPhone": "请输入手机号",
    "invalidPhone": "请输入有效的手机号格式"
  }
}
```

**Step 2: Create English translation file**

Create `main/messages/en.json`:
```json
{
  "Common": {
    "signIn": "Sign In",
    "signOut": "Sign Out",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "search": "Search",
    "create": "Create",
    "edit": "Edit",
    "delete": "Delete",
    "save": "Save",
    "loading": "Loading...",
    "noData": "No data available",
    "back": "Back"
  },
  "Nav": {
    "home": "Home",
    "library": "Library",
    "appStore": "App Store",
    "docs": "Docs",
    "myAccount": "My Account",
    "myRecord": "My Record",
    "dataAnnotation": "Data Annotation",
    "api": "API",
    "admin": "Admin",
    "settings": "Settings",
    "learning": "Learning",
    "gaming": "Gaming",
    "ai": "AI",
    "others": "Others"
  },
  "Auth": {
    "selectRole": "Select Your Role",
    "selectRoleDesc": "Please choose your role to continue",
    "learner": "Learner",
    "tagger": "Tagger",
    "researcher": "Researcher",
    "signInWith": "Sign in with {provider}",
    "orContinueWith": "Or continue with",
    "termsOfService": "Terms of Service",
    "privacyPolicy": "Privacy Policy"
  },
  "Home": {
    "globalSearch": "Global Search",
    "trending": "Trending",
    "searchPlaceholder": "Search Cantonese content..."
  },
  "Library": {
    "title": "Cantonese Corpus",
    "selectTag": "Select a tag",
    "classic": "Classic",
    "dictionary": "Dictionary",
    "importing": "Importing",
    "rawCorpus": "Raw Corpus",
    "size": "Size"
  },
  "AppStore": {
    "launch": "Launch App",
    "launchIntl": "Launch App (International)",
    "appHome": "App Homepage"
  },
  "DataAnnotation": {
    "title": "Data Annotation",
    "batchUpload": "Batch Upload",
    "downloadTemplate": "Download Template",
    "character": "Character",
    "category": "Category",
    "pronunciation": "Pronunciation",
    "wordGroup": "Word Group",
    "sentence": "Sentence",
    "reference": "Reference",
    "videoClip": "Video Clip",
    "notEditable": "This entry is not editable"
  },
  "Profile": {
    "title": "Profile",
    "editProfile": "Edit Profile",
    "systemAdmin": "System Admin",
    "bind": "Bind",
    "unbind": "Unbind",
    "change": "Change",
    "notSet": "Not set",
    "noWallet": "No wallet bound",
    "updateSuccess": "Profile updated successfully",
    "updateFailed": "Failed to update profile"
  },
  "Validation": {
    "enterCharacter": "Please enter a character",
    "atLeastOnePronunciation": "Please enter at least one pronunciation",
    "selectFile": "Please select a file first",
    "enterPhone": "Please enter phone number",
    "invalidPhone": "Please enter a valid phone number"
  }
}
```

**Step 3: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add zh-CN and en translation files"
```

---

### Task 3: Update next.config.ts with next-intl plugin

**Files:**
- Modify: `main/next.config.ts`

**Step 1: Add next-intl plugin wrapper**

In `main/next.config.ts`, wrap the existing config with `createNextIntlPlugin`:

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  serverExternalPackages: ['ali-oss'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'thirdwx.qlogo.cn',
      },
      {
        protocol: 'https',
        hostname: 'dimsum-user-avatar.oss-cn-guangzhou.aliyuncs.com',
      },
    ],
  },
  turbopack: {
    rules: {
      '*.md': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    });
    return config;
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
```

**Step 2: Commit**

```bash
git add next.config.ts
git commit -m "feat(i18n): add next-intl plugin to next.config.ts"
```

---

### Task 4: Migrate middleware.ts to proxy.ts with combined i18n + auth

**Files:**
- Delete: `main/middleware.ts`
- Create: `main/proxy.ts`

**Context:** Next.js 16 renamed `middleware.ts` to `proxy.ts`. We need to merge next-intl's locale routing with the existing next-auth protection logic.

**Step 1: Create proxy.ts combining next-intl and next-auth**

Create `main/proxy.ts`:

```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { Role } from '@prisma/client';

const intlMiddleware = createMiddleware(routing);

// Routes that require authentication (after locale prefix is stripped)
const protectedPatterns = [
  /^\/dashboard(\/|$)/,
  /^\/profile(\/|$)/,
  /^\/account(\/|$)/,
  /^\/marker(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/workplace(\/|$)/,
];

// Routes that require specific roles
const taggerPatterns = [
  /^\/marker(\/|$)/,
  /^\/account\/data-annotation(\/|$)/,
];

const adminPattern = /^\/admin(\/|$)/;

function getPathnameWithoutLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return pathname.slice(`/${locale}`.length) || '/';
    }
  }
  return pathname;
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip i18n for API routes and static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/_vercel/') ||
    pathname.includes('.')
  ) {
    // Still apply auth for protected API routes
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/public') && !pathname.startsWith('/api/auth') && !pathname.startsWith('/api/miniprogram')) {
      const token = await getToken({ req: request });
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (pathname.startsWith('/api/marker')) {
        if (token.role !== Role.TAGGER_PARTNER && token.role !== Role.TAGGER_OUTSOURCING) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }
    return NextResponse.next();
  }

  // For page routes: first check auth, then apply intl
  const strippedPathname = getPathnameWithoutLocale(pathname);
  const isProtected = protectedPatterns.some(p => p.test(strippedPathname));

  if (isProtected) {
    const token = await getToken({ req: request });

    if (!token) {
      // Determine locale for redirect
      const locale = routing.locales.find(l => pathname.startsWith(`/${l}`)) || routing.defaultLocale;
      const signInUrl = new URL(`/${locale}/auth/signin`, request.url);
      signInUrl.searchParams.set('callbackUrl', request.url);
      return NextResponse.redirect(signInUrl);
    }

    // Role-based checks
    const isTaggerRoute = taggerPatterns.some(p => p.test(strippedPathname));
    if (isTaggerRoute && token.role !== Role.TAGGER_PARTNER && token.role !== Role.TAGGER_OUTSOURCING) {
      const locale = routing.locales.find(l => pathname.startsWith(`/${l}`)) || routing.defaultLocale;
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }

    if (adminPattern.test(strippedPathname) && !token.isSystemAdmin) {
      const locale = routing.locales.find(l => pathname.startsWith(`/${l}`)) || routing.defaultLocale;
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
  }

  // Apply i18n routing (locale detection, redirect, rewrite)
  return intlMiddleware(request);
}

export const config = {
  matcher: '/((?!_next|_vercel|.*\\..*).*)',
};
```

**Step 2: Delete old middleware.ts**

Run: `rm main/middleware.ts`

**Step 3: Verify the app starts**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm dev`

Check that:
- `/` redirects to `/zh-CN`
- `/library` redirects to `/zh-CN/library`
- No console errors

**Step 4: Commit**

```bash
git add proxy.ts
git rm middleware.ts
git commit -m "feat(i18n): migrate middleware.ts to proxy.ts with combined i18n + auth"
```

---

### Task 5: Move pages into [locale] segment and update root layout

**Files:**
- Create: `main/app/[locale]/layout.tsx` (new locale-aware root layout)
- Modify: `main/app/layout.tsx` (simplify to bare html shell)
- Move: `main/app/(home)/` → `main/app/[locale]/(home)/`
- Move: `main/app/(account)/` → `main/app/[locale]/(account)/`
- Move: `main/app/admin/` → `main/app/[locale]/admin/`
- Move: `main/app/providers.tsx` (stays in place, referenced by new layout)

**Step 1: Create the [locale] layout**

Create `main/app/[locale]/layout.tsx`:

```tsx
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { ConditionalLayout } from '@/components/layout/conditional-layout';
import { Providers } from '../providers';
import { Toaster } from '@/components/ui/sonner';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <Providers>
        <ConditionalLayout>{children}</ConditionalLayout>
        <Toaster />
      </Providers>
    </NextIntlClientProvider>
  );
}
```

**Step 2: Simplify root layout to bare HTML shell**

Update `main/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Cantonese AI Data & App Hub | DimSum AI Labs',
  description: 'The Best & The most AI-friendly Data Hub for Cantonese✌️',
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function RootLayout({ children, params }: Props) {
  const { locale } = await params;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
      </head>
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

**Step 3: Move route groups into [locale]**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main

# Create the [locale] directory
mkdir -p "app/[locale]"

# Move route groups
mv "app/(home)" "app/[locale]/(home)"
mv "app/(account)" "app/[locale]/(account)"

# Move admin if it exists
[ -d "app/admin" ] && mv "app/admin" "app/[locale]/admin"
```

**Note:** `app/api/` stays at `app/api/` — API routes do NOT move into `[locale]`.

**Step 4: Verify the app still works**

Run: `pnpm dev`

Check that:
- `/zh-CN` loads the homepage
- `/zh-CN/library` loads the library page
- `/en` loads the homepage in English context (UI not yet translated)
- `/api/auth/...` still works (not moved)

**Step 5: Commit**

```bash
git add app/
git commit -m "feat(i18n): move pages into [locale] segment and split layouts"
```

---

### Task 6: Create LocaleSwitcher component and add to header

**Files:**
- Create: `main/components/locale-switcher.tsx`
- Modify: `main/components/layout/header.tsx`
- Modify: `main/components/layout/floating-nav.tsx`

**Step 1: Create LocaleSwitcher component**

Create `main/components/locale-switcher.tsx`:

```tsx
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale() {
    const newLocale = locale === 'zh-CN' ? 'en' : 'zh-CN';
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <Button variant="ghost" size="icon" onClick={switchLocale} title="Switch language">
      <Globe className="h-4 w-4" />
      <span className="sr-only">{locale === 'zh-CN' ? 'English' : '中文'}</span>
    </Button>
  );
}
```

**Step 2: Add LocaleSwitcher to header.tsx**

In `main/components/layout/header.tsx`, import and add the `LocaleSwitcher` next to the existing ThemeToggle button. Find where `ThemeToggle` is rendered and add `<LocaleSwitcher />` before or after it.

**Step 3: Add LocaleSwitcher to floating-nav.tsx**

Same pattern — add `<LocaleSwitcher />` in the floating nav's action area.

**Step 4: Verify switching works**

Run: `pnpm dev`
- Click the globe icon → URL changes from `/zh-CN/...` to `/en/...` and back
- Page does not full-reload

**Step 5: Commit**

```bash
git add components/locale-switcher.tsx components/layout/header.tsx components/layout/floating-nav.tsx
git commit -m "feat(i18n): add LocaleSwitcher component to header and floating nav"
```

---

### Task 7: Internationalize navigation labels (menu-config)

**Files:**
- Modify: `main/components/layout/sidebar/menu-config.ts` → convert to hook or use translation keys
- Modify: `main/components/layout/header.tsx` — use `useTranslations('Nav')`
- Modify: `main/components/layout/floating-nav.tsx` — use `useTranslations('Nav')`
- Modify: `main/components/layout/sidebar/main-menu.tsx` — use `useTranslations('Nav')`

**Step 1: Change menu-config to use translation keys instead of hardcoded labels**

Update `main/components/layout/sidebar/menu-config.ts` — replace hardcoded labels with i18n keys:

```ts
// Change label values to translation keys
export const menuItems = [
  { icon: Home, labelKey: "home", href: "/" },
  { icon: LibraryBig, labelKey: "library", href: "/library" },
  {
    icon: AppWindow,
    labelKey: "appStore",
    href: "/appStore",
    children: [
      { icon: BookOpen, labelKey: "learning", href: "/appStore?category=Learning" },
      { icon: Gamepad2, labelKey: "gaming", href: "/appStore?category=Gaming" },
      { icon: Bot, labelKey: "ai", href: "/appStore?category=AI" },
      { icon: MoreHorizontal, labelKey: "others", href: "/appStore?category=Others" },
    ],
  },
  { icon: FileCode2, labelKey: "docs", href: "/docs" },
];
```

Then in components that render these items, use `useTranslations('Nav')` to resolve keys:

```tsx
const t = useTranslations('Nav');
// ...
{menuItems.map(item => (
  <Link key={item.href} href={item.href}>
    <item.icon />
    <span>{t(item.labelKey)}</span>
  </Link>
))}
```

**Step 2: Update header.tsx to use translations**

Replace hardcoded strings like `"Sign In"`, `"Sign Out"`, `"Admin"` with `t()` calls using the `Common` and `Nav` namespaces.

**Step 3: Update floating-nav.tsx similarly**

**Step 4: Update sidebar components similarly**

**Step 5: Verify all navigation labels show correctly in both languages**

Switch between zh-CN and en, confirm all nav items show translated text.

**Step 6: Commit**

```bash
git add components/layout/
git commit -m "feat(i18n): internationalize navigation and menu labels"
```

---

### Task 8: Update internal links to use next-intl navigation

**Files:**
- Modify: Any component using `next/link` or `next/navigation` for app-internal links

**Context:** Replace `import Link from 'next/link'` with `import { Link } from '@/i18n/navigation'` so that links automatically include the locale prefix. Similarly replace `useRouter` and `usePathname` from `next/navigation` with the next-intl versions.

**Step 1: Find all files importing from next/link and next/navigation**

Run:
```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main
grep -rn "from 'next/link'" --include="*.tsx" --include="*.ts" app/ components/ | grep -v node_modules
grep -rn "from 'next/navigation'" --include="*.tsx" --include="*.ts" app/ components/ | grep -v node_modules
```

**Step 2: Replace imports progressively**

For each file:
- `import Link from 'next/link'` → `import { Link } from '@/i18n/navigation'`
- `import { useRouter } from 'next/navigation'` → `import { useRouter } from '@/i18n/navigation'`
- `import { usePathname } from 'next/navigation'` → `import { usePathname } from '@/i18n/navigation'`
- `import { redirect } from 'next/navigation'` → `import { redirect } from '@/i18n/navigation'`

**Important exceptions — do NOT replace:**
- Files in `app/api/` (server-side API routes)
- `redirect()` in Server Components that use `next/navigation` server-side — use `import { redirect } from '@/i18n/navigation'` for these too, but verify behavior

**Step 3: Verify internal navigation works**

- Click links → URLs include locale prefix
- Browser back/forward works
- No broken links

**Step 4: Commit**

```bash
git add app/ components/
git commit -m "feat(i18n): replace next/link and next/navigation with next-intl navigation"
```

---

### Task 9: Internationalize homepage (Phase 3 start)

**Files:**
- Modify: `main/app/[locale]/(home)/page.tsx`

**Step 1: Add useTranslations to the homepage**

```tsx
import { useTranslations } from 'next-intl';
// or for Server Components:
import { getTranslations } from 'next-intl/server';
```

Replace hardcoded strings:
- `"全局搜索"` → `t('globalSearch')`
- `"热搜"` → `t('trending')`
- `"搜索 Cantonese content..."` → `t('searchPlaceholder')`

**Step 2: Verify both languages render correctly**

- `/zh-CN` shows Chinese UI
- `/en` shows English UI
- Hot terms (粤语词汇) remain unchanged (content, not UI)

**Step 3: Commit**

```bash
git add "app/[locale]/(home)/page.tsx"
git commit -m "feat(i18n): internationalize homepage UI text"
```

---

### Task 10: Internationalize remaining pages (progressive)

Repeat the pattern from Task 9 for each page. Priority order:

1. **Library page** — `app/[locale]/(home)/library/page.tsx` using `Library` namespace
2. **AppStore page** — `app/[locale]/(home)/appStore/page.tsx` using `AppStore` namespace
3. **Auth signin page** — `app/[locale]/(home)/auth/signin/page.tsx` using `Auth` namespace
4. **Profile page** — `app/[locale]/(account)/account/profile/page.tsx` using `Profile` namespace
5. **Data Annotation page** — `app/[locale]/(account)/account/data-annotation/page.tsx` using `DataAnnotation` namespace
6. **Dialog components** — `components/dialogs/` using `Auth`, `Validation` namespaces

For each page:
1. Import `useTranslations` or `getTranslations`
2. Replace hardcoded strings with `t('key')` calls
3. Add any missing keys to both `zh-CN.json` and `en.json`
4. Test both languages
5. Commit with message: `feat(i18n): internationalize [page name]`

---

### Task 11: Final verification and cleanup

**Step 1: Full smoke test**

Run: `pnpm dev`

Check all routes in both languages:
- [ ] `/zh-CN` — Homepage
- [ ] `/en` — Homepage
- [ ] `/zh-CN/library` — Library
- [ ] `/en/library` — Library
- [ ] `/zh-CN/appStore` — App Store
- [ ] `/zh-CN/auth/signin` — Sign In
- [ ] `/zh-CN/account/profile` — Profile (requires auth)
- [ ] Language switcher toggles correctly
- [ ] Auth flow works (sign in, sign out)
- [ ] API routes still work (`/api/...`)
- [ ] 404 page works for invalid locales (`/fr/library`)

**Step 2: Build check**

Run: `pnpm build`

Verify no build errors.

**Step 3: Commit any fixes**

```bash
git add .
git commit -m "feat(i18n): final verification and cleanup"
```

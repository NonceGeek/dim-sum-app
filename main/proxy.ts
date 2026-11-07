import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { Role } from '@prisma/client';
import { isCronJob, isDelegatedCollectionPage, isReviewWebhook } from '@/lib/admin-route-access';

const intlMiddleware = createMiddleware(routing);

// Routes that require authentication (after locale prefix is stripped)
const protectedPatterns = [
  /^\/dashboard(\/|$)/,
  /^\/profile(\/|$)/,
  /^\/account(\/|$)/,
  /^\/marker(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/workplace(\/|$)/,
  /^\/assistant(\/|$)/,
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

function redirectToHomeLogin(request: NextRequest, status: "required" | "prompt" | "failed", callbackPath?: string) {
  const locale = routing.locales.find(
    (locale) => request.nextUrl.pathname.startsWith(`/${locale}/`),
  );
  const home = new URL(locale ? `/${locale}` : "/", request.url);
  home.searchParams.set("login", status);
  if (callbackPath) home.searchParams.set("callbackUrl", callbackPath);
  return NextResponse.redirect(home);
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Service callbacks must reach their own mandatory Bearer-token validation.
  if (isReviewWebhook(pathname, request.method) || isCronJob(pathname, request.method)) return NextResponse.next();

  // Skip i18n for API routes and static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/_vercel/') ||
    pathname.includes('.')
  ) {
    // This exact read-only catalog serves published snapshots to visitors.
    // Do not exempt the whole namespace or any mutation method.
    if (request.method === 'GET' && pathname === '/api/app-store/apps') {
      return NextResponse.next();
    }
    // Still apply auth for protected API routes
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/public') && !pathname.startsWith('/api/search') && !pathname.startsWith('/api/entries') && !pathname.startsWith('/api/auth') && !pathname.startsWith('/api/miniprogram')) {
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
  if (strippedPathname === "/auth/signin") {
    if (request.nextUrl.searchParams.has("error")) {
      return redirectToHomeLogin(request, "failed");
    }
    return redirectToHomeLogin(
      request,
      "prompt",
      request.nextUrl.searchParams.get("callbackUrl") || undefined,
    );
  }

  const isProtected = protectedPatterns.some(p => p.test(strippedPathname));

  if (isProtected) {
    const token = await getToken({ req: request });

    if (!token) {
      return redirectToHomeLogin(request, "required", pathname + request.nextUrl.search);
    }

    // Role-based checks
    const isTaggerRoute = taggerPatterns.some(p => p.test(strippedPathname));
    if (isTaggerRoute && token.role !== Role.TAGGER_PARTNER && token.role !== Role.TAGGER_OUTSOURCING) {
      const locale = routing.locales.find(l => pathname.startsWith(`/${l}`)) || routing.defaultLocale;
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }

    if (adminPattern.test(strippedPathname) && !token.isSystemAdmin && !token.isSuperAdmin && !isDelegatedCollectionPage(strippedPathname)) {
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

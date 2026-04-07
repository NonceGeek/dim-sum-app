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
  const referer = request.headers.get('referer') || '';

  // Check if this is a library/cantharm request or library assets
  const isCantharmPath = pathname.startsWith('/library/cantharm');
  const isLibraryAsset = pathname.startsWith('/library/assets/') || pathname.startsWith('/library/');
  const isFromCantharm = referer.includes('/library/cantharm');
  // Match static files by extension
  const isStaticResource = pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json|webp|html|htm|xml|pdf|zip|tar|gz)$/i);

  // Also proxy static resources if they don't look like Next.js assets
  const isNextJsAsset = pathname.startsWith('/_next/') || pathname.startsWith('/static/');
  const shouldProxy = isCantharmPath || isLibraryAsset || (isStaticResource && !isNextJsAsset && (isFromCantharm || !referer));

  // console.log('[proxy] Debug:', { pathname, referer: referer || 'empty', isCantharmPath, isFromCantharm, isStaticResource: !!isStaticResource, shouldProxy });

  if (shouldProxy) {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      return new NextResponse('Backend URL not configured', { status: 500 });
    }

    // Handle cantharm paths - everything maps to /library/cantharm/ on backend
    let targetPath = pathname;

    // Ensure /library/cantharm has trailing slash
    if (pathname === '/library/cantharm') {
      targetPath = '/library/cantharm/';
    }
    // For /library/assets/* paths, rewrite to /library/cantharm/assets/*
    else if (pathname.startsWith('/library/assets/')) {
      const relativePath = pathname.replace('/library/assets/', '');
      targetPath = `/library/cantharm/assets/${relativePath}`;
    }
    // For other library/* paths, rewrite to /library/cantharm/*
    else if (pathname.startsWith('/library/') && !pathname.startsWith('/library/cantharm/')) {
      const relativePath = pathname.replace('/library/', '');
      targetPath = `/library/cantharm/${relativePath}`;
    }

    const targetUrl = `${backendUrl}${targetPath}`;
    console.log('[proxy] Forwarding:', pathname, '->', targetUrl);

    try {
      const response = await fetch(targetUrl, {
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          host: new URL(backendUrl).host,
        },
      });

      // console.log('[proxy] Response status:', response.status, response.statusText);
      // console.log('[proxy] Response headers:', Object.fromEntries(response.headers.entries()));

      // Handle 304 Not Modified - can't manually construct 304 response
      if (response.status === 304) {
        return new NextResponse(null, {
          status: 304,
          headers: response.headers,
        });
      }

      // Copy response headers and body
      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        responseHeaders.set(key, value);
      });

      const body = await response.arrayBuffer();
      return new NextResponse(body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error('[proxy] Error:', error);
      return new NextResponse('Proxy error', { status: 502 });
    }
  }

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
  matcher: [
    // Handle library paths explicitly
    { source: '/library/:path*' },
    // Handle all other paths
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

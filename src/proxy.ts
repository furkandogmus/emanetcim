import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { isAdminPath as matchesAdminPath, isPartnerPath as matchesPartnerPath } from './lib/route-protection';

const { auth } = NextAuth({
  ...authConfig,
  trustHost: process.env.AUTH_TRUST_HOST !== "false",
});


const intlMiddleware = createMiddleware(routing);

function stripLocalePrefix(pathname: string): { locale: string; barePath: string } {
  for (const loc of routing.locales) {
    const prefix = `/${loc}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return {
        locale: loc,
        barePath: pathname.slice(prefix.length) || "/",
      };
    }
  }
  return { locale: routing.defaultLocale, barePath: pathname };
}

/**
 * Next.js 16 Proxy (eski adiyla middleware) — Auth.js v5 + next-intl + rol korumasi.
 *
 * `middleware.ts` Next 16'da kullanimdan kaldirildi; dosya ve disa aktarilan
 * fonksiyon `proxy` oldu (2026-08-22). Davranis ayni.
 *
 * Guvenlik basliklari BURADA DEGIL, `next.config.ts` `headers()` icinde: ayni
 * basliklar iki yerde set ediliyordu ve biri (`X-XSS-Protection`) artik
 * tarayicilarin yok saydigi, OWASP'in "koymayin" dedigi bir baslikti.
 */
const authProxy = auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  // 1. Static Asset Bypass (Fast-path)

  if (
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/manifest.json') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/monitoring') ||
    pathname === '/favicon.ico' ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next();
  }

  // Auth.js pages.signIn locale öneki olmadan "/login" döner — next-intl'den önce locale ekle
  if (pathname === '/login' || pathname === '/auth/error') {
    const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;
    const locale = routing.locales.includes(
      cookieLocale as (typeof routing.locales)[number],
    )
      ? cookieLocale!
      : routing.defaultLocale;
    const url = nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // API: istek korelasyonu (loglar ve hata ayıklama)
  if (pathname.startsWith('/api/')) {
    const requestId =
      req.headers.get('x-request-id') || crypto.randomUUID();
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-request-id', requestId);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  // 2. I18n Middleware (Handles locale prefixing and redirects)
  const response = intlMiddleware(req);
  
  // Eğer intlMiddleware bir yönlendirme yapıyorsa (örn: /tr ekliyorsa), doğrudan o cevabı dönelim.
  // Bu, sonsuz yönlendirme döngülerini (redirect loops) önler.
  if (response.headers.has('x-next-intl-redirect') || response.status === 307 || response.status === 308) {
    return response;
  }

  // 3. Protection Logic (Manually detect localized protected paths)
  const { locale: pathLocale, barePath: pathWithoutLocale } =
    stripLocalePrefix(pathname);

  const isAdminPath = matchesAdminPath(pathWithoutLocale);
  const isPartnerPath = matchesPartnerPath(pathWithoutLocale);
  const isInternalApiPath = pathWithoutLocale.startsWith("/api/internal");

  if (isAdminPath || isPartnerPath) {
    if (!isLoggedIn) {
      const loginUrl = new URL(`/${pathLocale}/login`, nextUrl);
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    if (isAdminPath && userRole !== "ADMIN") {
      const homeUrl = new URL(`/${pathLocale}`, nextUrl);
      return NextResponse.redirect(homeUrl);
    }

    if (isPartnerPath && userRole !== "PARTNER" && userRole !== "ADMIN") {
      const homeUrl = new URL(`/${pathLocale}`, nextUrl);
      return NextResponse.redirect(homeUrl);
    }
  }

  // 4. Internal API Protection (Cron/Jobs) - This is usually handled by secrets,
  // but we can add an extra layer if no secret is present.
  if (isInternalApiPath && !isLoggedIn && !req.headers.get("authorization") && !req.headers.get("x-cron-secret")) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  return response;

});

export function proxy(request: NextRequest) {
  return (authProxy as (r: NextRequest) => ReturnType<typeof authProxy>)(request);
}

export const config = {
  // Matcher for i18n and Auth (Excluding static assets strictly)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons/|monitoring).*)',
    '/',
    '/(tr|en|de|fr|ja|fa)/:path*',
  ],
};

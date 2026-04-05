import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const { auth } = NextAuth({
  ...authConfig,
  trustHost: process.env.AUTH_TRUST_HOST !== "false",
});


const intlMiddleware = createMiddleware(routing);

/**
 * Next.js 16+ Proxy — Auth.js v5, next-intl & Security Hardening
 * Named export `proxy` matches the file convention (see Next.js proxy docs).
 */
const authProxy = auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Proxy] Path: ${pathname} | LoggedIn: ${isLoggedIn} | Role: ${userRole}`);
  }

  // 1. Static Asset Bypass (Fast-path)

  if (
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/manifest.json') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next();
  }

  // Auth.js pages.signIn locale öneki olmadan "/login" döner — next-intl'den önce locale ekle
  if (pathname === '/login' || pathname === '/auth/error') {
    const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;
    const locale = cookieLocale === 'en' ? 'en' : 'tr';
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

  // 3. Security Headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');

  // 4. Protection Logic (Manually detect localized protected paths)
  const isLocaleTr = pathname.startsWith('/tr');
  const isLocaleEn = pathname.startsWith('/en');
  
  // Kritik: Rota kontrolünü yaparken dil önekini temizleyelim
  const pathWithoutLocale = isLocaleTr ? pathname.replace('/tr', '') : isLocaleEn ? pathname.replace('/en', '') : pathname;
  
  const isAdminPath = pathWithoutLocale.startsWith('/admin');
  const isPartnerPath = pathWithoutLocale.startsWith('/partner');

  if (isAdminPath || isPartnerPath) {
    if (!isLoggedIn) {
      const locale = isLocaleTr ? 'tr' : (isLocaleEn ? 'en' : 'tr');
      const loginUrl = new URL(`/${locale}/login`, nextUrl);
      loginUrl.searchParams.set('callbackUrl', nextUrl.pathname + nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    // Role-based Access Control
    if (isAdminPath && userRole !== 'ADMIN') {
      const homeUrl = new URL(isLocaleTr ? '/tr' : (isLocaleEn ? '/en' : '/tr'), nextUrl);
      return NextResponse.redirect(homeUrl);
    }
    
    if (isPartnerPath && userRole !== 'PARTNER' && userRole !== 'ADMIN') {
      const homeUrl = new URL(isLocaleTr ? '/tr' : (isLocaleEn ? '/en' : '/tr'), nextUrl);
      return NextResponse.redirect(homeUrl);
    }
  }

  return response;

});

export function proxy(request: NextRequest) {
  return (authProxy as (r: NextRequest) => ReturnType<typeof authProxy>)(request);
}

/** Next.js 16: `middleware` adı `proxy.ts` içinde tanımlanır (ayrı `middleware.ts` dosyası kullanılmaz). */
export { proxy as middleware };

export const config = {
  // Matcher for i18n and Auth (Excluding static assets strictly)
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons/).*)',
    '/',
    '/(tr|en)/:path*'
  ]
};



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

  /*
    BURADA BIR `/api/internal` KONTROLU VARDI; HIC CALISMIYORDU (2026-08-31).

    Yukaridaki 1. adim `pathname.startsWith('/api/')` gorunce `NextResponse.next`
    ile ERKEN DONUYOR -- `/api/internal/...` de `/api/` ile basladigi icin akis
    buraya asla ulasmiyordu. Silindi.

    Silinmesi hicbir korumayi kaldirmiyor, cunku ilettigi koruma zaten yoktu:
    kontrol `authorization` ya da `x-cron-secret` basliginin YALNIZCA VARLIGINA
    bakiyordu, degerine degil. Yani `X-Cron-Secret: x` yazan herkes gecerdi.

    Gercek savunma `src/lib/internal-api-guard.ts` icindeki `authorizeCron`:
    `CRON_SECRET`i `crypto.timingSafeEqual` ile karsilastiriyor ve sekiz ic ucun
    HEPSI onu cagiriyor (`auth-endpoint-guards` testi bunu sabitliyor).

    Calismayan bir kapiyi kodda birakmak, koruma sanildigi surece ondan daha
    kotudur: birisi "zaten proxy koruyor" diyip yeni bir ic uca `authorizeCron`
    koymayabilir.
  */
  return response;

});

export function proxy(request: NextRequest) {
  return (authProxy as (r: NextRequest) => ReturnType<typeof authProxy>)(request);
}

export const config = {
  /*
    STATIK DOSYALAR ARA KATMANA HIC GIRMEZ.

    Eski matcher statik yollari TEK TEK sayiyordu (`sw.js|manifest.json|icons/`
    ...) ve bu liste dort yerde eksikti. Sayilmayan her statik yol i18n
    yonlendirmesine yakalaniyordu: `/images/blog/x.webp` -> 307 ->
    `/tr/images/blog/x.webp`.

    Uretimde olculdu (2026-09-01, konteynerin icinden 127.0.0.1:3000):

      /images/blog/*.webp   307 -> /tr/images/...   blog kapaklari + sehir kartlari
      /og-image.png         307 -> /tr/og-image.png  butun paylasim kartlari
      /push-sw.js           307 -> /tr/push-sw.js    web push worker kaydi
      /next.svg             307 -> /tr/next.svg

    Disaridan fark edilmiyordu cunku nginx `/images/*`i Next'e hic ugratmadan
    servis ediyor. Ama `next/image` yerel dosyayi KENDI ICINDEN cekiyor, oradaki
    307'ye takiliyor ve "The requested resource isn't a valid image" (400)
    donuyordu. Blog listesindeki kirik kucuk resimler buydu.

    Enumerasyon yerine kural: NOKTA ICEREN her yol statik dosyadir ve gecmez.
    Uygulama rotalarinda nokta yok (blog slug'lari `[a-z0-9-]` ile sinirli;
    `blog-city-posts.ts --verify` bunu zorunlu tutuyor). `_next/` ve
    `monitoring` noktasiz oldugu icin ayrica yaziliyor.

    Bu satiri degistirirken `proxy-static-matcher` testini de calistirin;
    yukaridaki dort yol orada sabitlendi.
  */
  matcher: [
    '/((?!_next/|monitoring|.*\\.).*)',
    '/',
    '/(tr|en|de|fr|ja|fa)/:path*',
  ],
};

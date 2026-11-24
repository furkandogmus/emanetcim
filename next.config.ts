import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/*
  HSTS burada YOK: `headers()` build aninda donar ve CI imaji `ENABLE_HSTS_HEADERS`
  olmadan kuruyordu, yani bayrak uretimde hic etki etmiyordu. Baslik nginx'te
  (nginx/conf.d/default.conf, 443 server bloklari).
*/
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  /*
    Sayfayi baska kokenden acilan pencerelerden ayirir (window.opener yok,
    Spectre tarzi sizintiya karsi ayri surec). `same-origin` guvenli: Google/
    Apple girisi Auth.js ile YONLENDIRME tabanli (`signIn(provider)`), acilir
    pencere kullanmiyor; mobil giris yerel SDK ile.
  */
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // NOTE: Next.js runtime injects inline bootstrap scripts/styles.
      // Keep unsafe-inline in production until nonce/hash CSP is implemented app-wide.
      /*
        'unsafe-eval' YALNIZCA GELISTIRMEDE (2026-09-12'de bulundu).

        React'in gelistirme yapisi `eval()` kullaniyor (farkli bir ortamdan
        cagri yiginini yeniden kurmak gibi hata ayiklama ozellikleri icin).
        Bu CSP onu engelliyordu, sonuc: `npm run dev` ile acilan HER sayfada
        konsolda kirmizi bir hata ve Next.js gelistirici katmaninda kalici bir
        "1 Issue" rozeti vardi -- yani gercek bir sorun cikinca gorulmeyecekti,
        cunku sayac zaten hic sifirlanmiyordu.

        URETIM SERTLIGI DEGISMEDI: `NODE_ENV=production` oldugunda liste
        kelimesi kelimesine eskisiyle ayni. `eval` yalnizca gelistiricinin
        kendi makinesinde aciliyor, ki orada zaten Turbopack'in kendisi de
        derlenmemis kod calistiriyor.
      */
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"} https://plausible.io https://static.cloudflareinsights.com https://*.crisp.chat`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.crisp.chat",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com https://*.crisp.chat",
      /*
        AGDAN CIKIS ADRESLERI ACIKCA SAYILDI (2026-09-10'da bulundu). Onceki
        hali `https: wss:` idi -- yani sayfada calisan JS herhangi bir HTTPS/WSS
        adresine fetch/XHR/WebSocket acabilirdi. CSP'nin asil amaci tam olarak
        buydu: HTML enjeksiyonuyla calisan bir script bulunsa bile veri disari
        SADECE bu listedeki adreslere sizdirilabilsin. Liste, istemci tarafinda
        (tarayicida) GERCEKTEN cagrilan adreslerden cikarildi (bkz.
        LocationPicker.tsx → nominatim, map-style.ts → openfreemap, Crisp/
        Plausible/Cloudflare Insights widget'lari).
      */
      "connect-src 'self' https://tiles.openfreemap.org https://nominatim.openstreetmap.org https://plausible.io https://static.cloudflareinsights.com https://*.crisp.chat wss://*.relay.crisp.chat wss://*.relay.rescue.crisp.chat",
      // MapLibre GL blob: üzerinden web worker üretir; yoksa /search haritası CSP'ye takılır.
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const CSP_REPORT_PATH = "/api/csp-report";
const CSP_REPORT_GROUP = "csp-endpoint";

/**
 * YALNIZCA RAPOR EDEN, daha siki politika (2026-11-23): hicbir seyi engellemez,
 * nonce'lu zorunlu CSP'den once neyin kirilacagini olcer. Zorunlu politikadan
 * TURETILIR ki host listeleri ayrismasin; zorunlu deger bayt bayt ayni kalir
 * (security-headers testi). `report-to` Chromium'da, `report-uri` digerlerinde.
 * ~7 gun sonra raporlar incelenip karar verilmeli (bkz. api/csp-report/route.ts).
 */
function reportOnlyCsp(enforced: string): string {
  const directives = enforced
    .split("; ")
    // `frame-ancestors` Report-Only'de yok sayilir ve konsola uyari basar; zorunluda zaten var.
    .filter((d) => !d.startsWith("frame-ancestors "))
    .map((d) =>
      d.startsWith("script-src ")
        ? d.split(" ").filter((t) => t !== "'unsafe-inline'").join(" ")
        : d,
    );
  return [
    ...directives,
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join("; ");
}

const enforcedCsp = securityHeaders.find((h) => h.key === "Content-Security-Policy")?.value ?? "";
securityHeaders.push(
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp(enforcedCsp) },
  { key: "Reporting-Endpoints", value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"` },
);

/**
 * PWA service worker KALDIRILDI (2026-08-23).
 *
 * `@ducanh2912/next-pwa` bir webpack eklentisi; Next 16 build'i Turbopack ile
 * calistigi icin hic devreye girmiyordu. Uretimde servis edilen `sw.js`, git'e
 * commit edilmis ESKİ bir dosyaydi — onbellek kurallari kodla eslesmiyordu ve
 * yetkili mobil API yanitlarini onbellekliyordu. Manifest + "ana ekrana ekle"
 * duruyor; `public/sw.js` artik kendini kaldiran minimal bir dosya.
 */

/**
 * `S3_PUBLIC_BASE_URL`den `next/image` icin uzak alan adi kalibi uretir.
 *
 * Degisken tanimsizsa BOS DIZI doner: derleme kirilmaz, yalnizca o alan adi
 * izinli olmaz -- ki depolama zaten yapilandirilmamis demektir ve yukleme
 * yuzeyi de acilmaz (`isStorageConfigured`).
 */
function storageRemotePattern() {
  const raw = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (!raw) return [];
  try {
    const url = new URL(raw);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
      },
    ];
  } catch {
    // Bozuk deger derlemeyi dusurmez; alan adi izinli olmaz, o kadar.
    return [];
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactCompiler: true,
  typescript: {
    // 2026-08-21: kaldırıldı — `npm run typecheck` 0 hata veriyordu (tek gerçek hata
    // hotels/page.tsx'teki t()/t.raw() karışıklığıydı, ayrıca düzeltildi). Bu bayrak
    // açıkken build tip hatalarını sessizce yutuyordu; tam da bu bug'ın prod'a
    // gitmesine izin veren şey buydu.
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      /*
        DEPOLAMA ALAN ADI ENV'DEN TURETILIYOR (2026-09-01).

        `next/image` yalnizca burada izin verilen alan adlarini cizer. S3 /
        CloudFront adresi listede olmadan dukkan vitrin fotografi UYGULAMADA
        HIC GORUNMEZ -- ustelik hata sessizdir, yalnizca gorsel bos kalir.
        Alan adi `S3_PUBLIC_BASE_URL`den okunuyor ki ortam degistiginde
        (CDN onu eklendiginde) burasi elle guncellenmek zorunda kalmasin.
      */
      ...storageRemotePattern(),
    ],
  },
  serverExternalPackages: ["@prisma/client", "pg"],
  /*
    Server Action govde siniri (2026-09-10'da bulundu): Next.js server
    action'lar icin varsayilan 1MB'dir (Next kendi action-handler'i asani
    kendisi 413 ile reddeder, `validateImageBytes` (MAX_IMAGE_BYTES=8MB) hic
    calismadan). `updateShopImageAction` ve check-in'deki `sealPhoto`
    ArrayBuffer'i bu sinirdan gecmek zorunda; telefon kamerasi fotograflari
    (2-5MB tipik, 8MB'a kadar kabul ediliyor) neredeyse hepsi bu varsayilanla
    sunucuya hic ulasmadan reddediliyordu. ArrayBuffer'in RSC tasima
    katmaninda base64'e donusme payi icin 8MB'in üzerinde marj birakildi.
  */
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  // Uygulama baglantisi dogrulama dosyalari (src/lib/app-links.ts).
  async rewrites() {
    return [
      { source: "/.well-known/assetlinks.json", destination: "/api/well-known/assetlinks" },
      { source: "/.well-known/apple-app-site-association", destination: "/api/well-known/apple-app-site-association" },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // `.mjs` MapLibre worker'i (scripts/copy-maplibre-worker.mjs): modul worker
        // yalnizca JS MIME ile calisir, nosniff de acik. Bkz. nginx/conf.d/default.conf.
        source: "/maplibre/:file*",
        headers: [{ key: "Content-Type", value: "text/javascript; charset=utf-8" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const hstsHeader =
  process.env.ENABLE_HSTS_HEADERS === "true"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : [];

const securityHeaders = [
  ...hstsHeader,
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
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
      "script-src 'self' 'unsafe-inline' https://plausible.io https://static.cloudflareinsights.com https://*.crisp.chat",
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);

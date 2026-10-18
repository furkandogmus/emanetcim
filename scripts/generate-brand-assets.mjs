#!/usr/bin/env node
/**
 * Marka görsellerini tek kaynaktan üretir: `public/brand/logo-mark.svg`.
 *
 *   node scripts/generate-brand-assets.mjs
 *
 * NEDEN BETİK: logo 2026-10-18'de valiz + renkli konum pini işaretine geçti.
 * Favicon, PWA ikonları, bildirim rozeti, paylaşım görseli ve mobil uygulama
 * ikonları elle kırpılırsa birbirinden ayrışıyor; logo değişince bu betik
 * yeniden çalıştırılır, çıktılar commit'lenir.
 *
 * `sharp` Next.js'in bağımlılığı olarak `node_modules`'ta hazır geliyor.
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const MARK = readFileSync("public/brand/logo-mark.svg", "utf8");
// viewBox="30 20 420 520": işaret dikey, en/boy oranı 420:520.
const ASPECT = 420 / 520;
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const WARM_BG = { r: 253, g: 252, b: 251, alpha: 1 }; // mobil tokens.bg (#FDFCFB)

/** İşareti `height` px yüksekliğinde PNG tamponu olarak çizer. */
function markPng(height) {
  return sharp(Buffer.from(MARK), { density: Math.max(72, (height / 520) * 72 * 4) })
    .resize({ height: Math.round(height), width: Math.round(height * ASPECT), fit: "contain", background: CLEAR })
    .png()
    .toBuffer();
}

/** `size` kare tuval, ortasında tuval yüksekliğinin `ratio` kadarı işaret. */
async function squareIcon(size, ratio, background) {
  const mark = await markPng(size * ratio);
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}

/**
 * Android bildirim rozeti yalnızca alfa kanalını kullanır (sistem beyaza boyar).
 * Renkten ayıklamak gökkuşağının turuncu dilimini de yakalıyordu; bu yüzden
 * rozet şekilden çizilir: dolu valiz, pin oyuk, pinin göbeği yine dolu.
 */
const PIN = "M167.22 298.94 L230.30 385.66 A12 12 0 0 0 249.70 385.66 L312.78 298.94 A90 90 0 1 0 167.22 298.94 Z";
const BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 20 420 520">
  <defs><mask id="m"><rect x="0" y="0" width="600" height="600" fill="#fff"/>
    <path d="${PIN}" fill="#000" stroke="#000" stroke-width="16" stroke-linejoin="round"/>
    <circle cx="240" cy="246" r="43.2" fill="#fff"/></mask></defs>
  <g mask="url(#m)" fill="#fff">
    <path d="M170 140 V92 a36 36 0 0 1 36 -36 h68 a36 36 0 0 1 36 36 V140" fill="none" stroke="#fff" stroke-width="32"/>
    <rect x="60" y="112" width="360" height="340" rx="56"/>
    <circle cx="140" cy="482" r="32"/><circle cx="340" cy="482" r="32"/>
  </g></svg>`;

async function badge(size) {
  const h = Math.round(size * 0.86);
  const silhouette = await sharp(Buffer.from(BADGE_SVG), { density: 300 })
    .resize({ height: h, width: Math.round(h * ASPECT) })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: CLEAR } })
    .composite([{ input: silhouette, gravity: "center" }])
    .png()
    .toBuffer();
}

/** PNG gömülü ICO (Vista+ ve bütün güncel tarayıcılar okur). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

/** 1200x630 paylaşım görseli: işaret + "BagajPark" yazısı. */
async function ogImage() {
  const mark = await markPng(380);
  const text = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="260">
      <text x="0" y="120" font-family="Helvetica Neue, Arial, sans-serif" font-size="104" font-weight="800" fill="#1C1917">BagajPark</text>
      <text x="4" y="200" font-family="Helvetica Neue, Arial, sans-serif" font-size="40" font-weight="500" fill="#57534E">Valizini güvenle bırak, özgürce gez</text>
    </svg>`,
  );
  return sharp({ create: { width: 1200, height: 630, channels: 4, background: WARM_BG } })
    .composite([
      { input: mark, left: 110, top: 125 },
      { input: text, left: 470, top: 185 },
    ])
    .png()
    .toBuffer();
}

const out = {
  // Web
  "public/icons/icon-192x192.png": () => squareIcon(192, 0.8, WHITE),
  "public/icons/icon-512x512.png": () => squareIcon(512, 0.8, WHITE),
  // maskable: dairesel kırpmada güvenli alan çapın %80'i; işaret %60'ta kalır.
  "public/icons/icon-192x192-maskable.png": () => squareIcon(192, 0.6, WHITE),
  "public/icons/icon-512x512-maskable.png": () => squareIcon(512, 0.6, WHITE),
  "public/icons/badge-96x96.png": () => badge(96),
  "src/app/[locale]/apple-icon.png": () => squareIcon(180, 0.78, WHITE),
  "public/og-image.png": ogImage,
  // Mobil (Expo)
  "mobile-expo/assets/icon.png": () => squareIcon(1024, 0.78, WHITE),
  // Adaptif ikon: arka plan app.json'da beyaz; ön plan 108dp'nin ortadaki 66dp'si güvenli.
  "mobile-expo/assets/android-icon-foreground.png": () => squareIcon(1024, 0.56, CLEAR),
  "mobile-expo/assets/splash-icon.png": () => squareIcon(512, 0.9, CLEAR),
  "mobile-expo/assets/favicon.png": () => squareIcon(48, 0.92, CLEAR),
  // Android bildirim küçük ikonu: rozetle aynı tek renkli siluet (sistem boyar).
  "mobile-expo/assets/notification-icon.png": () => badge(96),
  // Uygulama içi marka işareti (giriş ekranı, ana sayfa); 3x yoğunluk için yüksek çizilir.
  "mobile-expo/assets/brand-mark.png": () => markPng(156),
};

for (const [path, make] of Object.entries(out)) {
  writeFileSync(path, await make());
  console.log("yazıldı", path);
}

const favicon = ico(
  await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await squareIcon(size, 0.96, CLEAR) }))),
);
for (const path of ["src/app/favicon.ico", "src/app/[locale]/favicon.ico"]) {
  writeFileSync(path, favicon);
  console.log("yazıldı", path);
}

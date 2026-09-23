/**
 * PWA manifest ekran goruntulerini uretir (Chrome'un zengin kurulum penceresi).
 * Hedef varsayilan olarak canli site; yerel icin: BASE_URL=http://localhost:3000
 *
 *   node scripts/pwa-screenshots.mjs
 *
 * Cikti public/screenshots/*.jpg -- boyutlar src/lib/pwa-manifest.ts ile ayni
 * olmali (narrow 780x1688 = 390x844 @2x, wide 1280x800 @1x).
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "https://bagajpark.com";
const SHOTS = [
  { file: "narrow-home.jpg", path: "/tr", viewport: { width: 390, height: 844 }, scale: 2 },
  { file: "narrow-search.jpg", path: "/tr/search", viewport: { width: 390, height: 844 }, scale: 2 },
  { file: "wide-search.jpg", path: "/tr/search", viewport: { width: 1280, height: 800 }, scale: 1 },
];

const browser = await chromium.launch();
try {
  for (const s of SHOTS) {
    const ctx = await browser.newContext({
      viewport: s.viewport,
      deviceScaleFactor: s.scale,
      locale: "tr-TR",
      geolocation: { latitude: 41.0256, longitude: 28.9741 },
      permissions: ["geolocation"],
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${s.path}`, { waitUntil: "networkidle" });
    // Cerez onay seridi goruntuye girmesin.
    await page.getByRole("button", { name: /kabul|accept/i }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `public/screenshots/${s.file}`, type: "jpeg", quality: 80 });
    console.log(`public/screenshots/${s.file}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

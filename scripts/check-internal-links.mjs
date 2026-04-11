#!/usr/bin/env node
/**
 * Basit iç link sağlığı: yaygın misafir yolları için GET.
 * Kullanım: BASE_URL=http://localhost:3000 node scripts/check-internal-links.mjs
 * (Sunucu çalışırken; CI’da Playwright veya staging URL ile koşturun.)
 */
const LOCALES = [
  "tr",
  "en",
  "de",
  "fr",
  "es",
  "it",
  "zh",
  "ja",
  "ar",
  "ko",
  "ru",
  "fa",
  "bg",
  "pl",
];

const paths = [
  "",
  "/search",
  "/blog",
  "/about",
  "/contact",
  "/faq",
  "/login",
  "/register",
];

const base = (process.env.BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);

const failures = [];

for (const locale of LOCALES) {
  for (const path of paths) {
    const url = `${base}/${locale}${path === "" ? "" : path}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "text/html" },
      });
      if (res.status >= 400) {
        failures.push({ url, status: res.status });
      }
    } catch (e) {
      failures.push({ url, error: String(e) });
    }
  }
}

if (failures.length) {
  console.error("Link check failures:", failures);
  process.exit(1);
}
console.log("Link check OK:", base, "paths×locales:", paths.length * LOCALES.length);

#!/usr/bin/env node
/**
 * Basit iç link sağlığı: yaygın misafir yolları için GET.
 * Kullanım: BASE_URL=http://localhost:3000 node scripts/check-internal-links.mjs
 * (Sunucu çalışırken; CI’da Playwright veya staging URL ile koşturun.)
 */
import { readFileSync } from "node:fs";

// Dil listesi `src/i18n/locales.ts`ten okunur: elle kopya ru eklenince geride kalmisti.
const localesSrc = readFileSync(new URL("../src/i18n/locales.ts", import.meta.url), "utf8");
const LOCALES = [...(/APP_LOCALES\s*=\s*\[([^\]]*)\]/.exec(localesSrc)?.[1] ?? "").matchAll(/"([a-z]{2})"/g)].map((m) => m[1]);
if (LOCALES.length === 0) throw new Error("APP_LOCALES src/i18n/locales.ts icinden okunamadi");

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

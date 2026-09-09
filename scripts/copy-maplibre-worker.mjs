#!/usr/bin/env node
/**
 * MapLibre GL v6 ESM-only worker'ini Next.js/Turbopack cozemiyor:
 * `new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url)`
 * kardes dosyasi `maplibre-gl-shared.mjs`'i kopyalamadan hash'lenmis bir
 * varlik uretiyor; worker ilk import'ta patliyor ve harita hicbir tile
 * istemiyor (bkz. maplibre-gl-js docs/index.md#installation, "Turbopack"
 * sekmesi, 2026-09-09'da okundu).
 *
 * Cozum resmi rehberde ayni: iki dosyayi da `public/`e kopyalayip
 * `setWorkerUrl` ile o yola isaret et (src/lib/maplibre-worker.ts).
 *
 * `predev`/`prebuild` npm hook'larindan cagrilir; node_modules'taki KURULU
 * surumden kopyalar, yani her zaman package.json'daki maplibre-gl ile eslesir.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const dist = path.join(
  path.dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")),
  "dist",
);
const dest = path.join(process.cwd(), "public", "maplibre");

mkdirSync(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(dist, file), path.join(dest, file));
}
console.log(`maplibre-gl worker dosyalari kopyalandi -> ${dest}`);

// Butun diller tr.json ile ayni anahtarlari tasimali. Eksik anahtar ekranda ham
// anahtar adi olarak gorunur; web'deki `locales.test.ts` mandalinin karsiligi.
// Cogul ekleri (_one/_few/_many/_other) dile gore degisir: taban adla karsilastirilir.
import { readFileSync } from "node:fs";

const LANGS = ["tr", "en", "de", "ru"];
const load = (l) => JSON.parse(readFileSync(new URL(`../src/locales/${l}.json`, import.meta.url), "utf8"));
const keys = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`],
  );
const base = (k) => k.replace(/_(zero|one|two|few|many|other)$/, "");

const sets = Object.fromEntries(LANGS.map((l) => [l, new Set(keys(load(l)).map(base))]));
let failed = false;
for (const l of LANGS.slice(1)) {
  const missing = [...sets.tr].filter((k) => !sets[l].has(k));
  const extra = [...sets[l]].filter((k) => !sets.tr.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`${l}.json eksik:`, missing, "fazla:", extra);
  }
}
if (failed) process.exit(1);
console.log(`locale paritesi tamam: ${sets.tr.size} anahtar, ${LANGS.join("/")}`);

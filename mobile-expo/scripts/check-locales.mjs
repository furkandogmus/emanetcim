// tr.json ve en.json ayni anahtarlari tasimali. Eksik anahtar ekranda ham
// anahtar adi olarak gorunur; web'deki `locales.test.ts` mandalinin karsiligi.
import { readFileSync } from "node:fs";

const load = (l) => JSON.parse(readFileSync(new URL(`../src/locales/${l}.json`, import.meta.url), "utf8"));
const keys = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`],
  );

const tr = new Set(keys(load("tr")));
const en = new Set(keys(load("en")));
const missingEn = [...tr].filter((k) => !en.has(k));
const missingTr = [...en].filter((k) => !tr.has(k));
if (missingEn.length || missingTr.length) {
  console.error("en.json'da eksik:", missingEn);
  console.error("tr.json'da eksik:", missingTr);
  process.exit(1);
}
console.log(`locale paritesi tamam: ${tr.size} anahtar`);

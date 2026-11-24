// Butun diller tr.json ile ayni anahtarlari tasimali. Eksik anahtar ekranda ham
// anahtar adi olarak gorunur; web'deki `locales.test.ts` mandalinin karsiligi.
// Cogul ekleri (_one/_few/_many/_other) dile gore degisir: taban adla karsilastirilir.
import { readFileSync } from "node:fs";

const LANGS = ["tr", "en", "de", "fr", "ja", "ru", "fa"];
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
// Her ceviri en.json'daki {{degisken}}leri tasimali; yoksa ekranda ham "{{name}}" ya da bos yer kalir.
const flat = (o, p = "", out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === "object" && !Array.isArray(v)) flat(v, `${p}${k}.`, out);
    else if (typeof v === "string") out[`${p}${k}`] = v;
  }
  return out;
};
const vars = (s) => [...s.matchAll(/\{\{\s*([\w.]+)/g)].map((m) => m[1]).join(",");
const en = flat(load("en"));
const enVars = {};
const plural = new Set();
const collect = (dict, into) => {
  for (const [k, v] of Object.entries(dict)) {
    if (k !== base(k)) plural.add(base(k));
    into[base(k)] = [into[base(k)], vars(v)].filter(Boolean).join(",");
  }
};
collect(en, enVars);
for (const l of LANGS.filter((x) => x !== "en")) {
  const seen = {};
  collect(flat(load(l)), seen);
  // {{count}} cogul bicimlerde dusebilir ("un jour", "одно"); i18next sayiyi zaten bilir.
  const norm = (k, s = "") =>
    [...new Set(s.split(",").filter((v) => v && !(v === "count" && plural.has(k))))].sort().join(",");
  const bad = Object.keys(seen).filter((k) => k in enVars && norm(k, seen[k]) !== norm(k, enVars[k]));
  if (bad.length) {
    failed = true;
    console.error(`${l}.json degisken uyusmazligi:`, bad);
  }
}
if (failed) process.exit(1);
console.log(`locale paritesi tamam: ${sets.tr.size} anahtar, ${LANGS.join("/")}`);

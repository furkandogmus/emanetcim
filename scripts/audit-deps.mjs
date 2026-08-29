#!/usr/bin/env node
/**
 * Bagimlilik acigi kapisi: prod bagimliliklarinda yuksek/kritik acik varsa kirar.
 *
 * Kullanim: node scripts/audit-deps.mjs   (npm run audit)
 *
 * NEDEN mandal degil de kapi: bir CVE'nin "tavani" olmaz. Bir acik ya
 * duzeltilir ya da NEDEN tasindigi yazilir. Istisna asagidaki listeye
 * gerekcesi ve GOZDEN GECIRME TARIHI ile girer; tarih gecince kapi yine
 * kirilir, boylece "kabul ettik" sessizce "unuttuk"a donusemez.
 */
import { spawnSync } from "node:child_process";

/** @type {{id: string, paket: string, neden: string, gozdenGecir: string}[]} */
const ISTISNALAR = [
  {
    id: "GHSA-ggr8-5vv4-36mx",
    paket: "deepmerge-ts",
    neden:
      "prisma (devDependency, CLI) -> @prisma/config -> deepmerge-ts. Ozyineli " +
      "nesne grafigi birlestirirken yigin tuketimi. Birlestirilen sey bizim " +
      "yazdigimiz prisma.config.ts; saldirgan girdisi degil ve uygulama " +
      "kodundan erisilemiyor. Tek duzeltmesi prisma 7.7 -> 6.12 majör düşürme.",
    gozdenGecir: "2026-11-30",
  },
];

const KIRAN = new Set(["high", "critical"]);

function auditOku() {
  // npm audit acik bulunca sifirdan farkli doner; cikis kodu bizim sinyalimiz degil.
  const r = spawnSync("npm", ["audit", "--json", "--omit=dev"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!r.stdout) {
    console.error("npm audit cikti uretmedi:", r.stderr?.trim() || r.error);
    process.exit(2);
  }
  try {
    return JSON.parse(r.stdout);
  } catch {
    console.error("npm audit ciktisi JSON degil.");
    process.exit(2);
  }
}

/** via girdilerinden GHSA kimligini cikarir; url yoksa sayisal source'a duser. */
function ghsaKimligi(via) {
  const m = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i.exec(via.url || "");
  return m ? m[0] : `source-${via.source}`;
}

function main() {
  const rapor = auditOku();
  const bugun = new Date().toISOString().slice(0, 10);

  const bulunan = new Map(); // ghsa -> {paket, severity, baslik, url}
  for (const [paket, v] of Object.entries(rapor.vulnerabilities || {})) {
    for (const via of v.via || []) {
      if (typeof via !== "object" || !KIRAN.has(via.severity)) continue;
      bulunan.set(ghsaKimligi(via), {
        paket,
        severity: via.severity,
        baslik: via.title || "(basliksiz)",
        url: via.url || "",
      });
    }
  }

  const istisnaHaritasi = new Map(ISTISNALAR.map((i) => [i.id, i]));
  const kiranlar = [];
  const suresiGecen = [];

  for (const [id, acik] of bulunan) {
    const istisna = istisnaHaritasi.get(id);
    if (!istisna) {
      kiranlar.push({ id, ...acik });
    } else if (istisna.gozdenGecir < bugun) {
      suresiGecen.push({ id, ...acik, gozdenGecir: istisna.gozdenGecir });
    }
  }

  // Duzeltilmis bir aciga ait istisna listede kalmasin -- uyari, kapi degil:
  // acik KAPANDIGI icin deploy'u kirmak yanlis olur.
  const bayat = ISTISNALAR.filter((i) => !bulunan.has(i.id));

  for (const b of bayat) {
    console.warn(
      `UYARI  istisna artik gecersiz, ISTISNALAR listesinden silin: ${b.id} (${b.paket})`,
    );
  }

  for (const s of suresiGecen) {
    console.error(
      `SURESI GECMIS  ${s.severity.toUpperCase()} ${s.id} (${s.paket})\n` +
        `   gozden gecirme tarihi ${s.gozdenGecir} gecti. Ya duzeltin ya da\n` +
        `   ISTISNALAR icindeki gerekceyi tazeleyip tarihi ileri alin.`,
    );
  }

  for (const k of kiranlar) {
    console.error(
      `${k.severity.toUpperCase().padEnd(8)} ${k.id}  ${k.paket}\n` +
        `   ${k.baslik}\n   ${k.url}`,
    );
  }

  const toplam = kiranlar.length + suresiGecen.length;
  if (toplam > 0) {
    console.error(
      `\n${toplam} yuksek/kritik acik kapiyi kirdi. Duzeltin, ya da bilincli ` +
        `tasiyorsaniz\nscripts/audit-deps.mjs icindeki ISTISNALAR listesine ` +
        `gerekce ve gozden gecirme tarihiyle ekleyin.`,
    );
    process.exit(1);
  }

  const kabul = ISTISNALAR.length - bayat.length;
  console.log(
    `Prod bagimliliklarinda yuksek/kritik acik yok` +
      (kabul > 0 ? ` (${kabul} bilincli istisna tasiniyor).` : "."),
  );
}

main();

#!/usr/bin/env node
/**
 * UI/UX regresyon taraması — bu denetimde kapatılan hataların GERİ GELMEDİĞİNİ
 * ölçer.
 *
 * Kullanım:
 *   node scripts/ux-sweep.mjs                      # canlıya karşı
 *   BASE_URL=http://localhost:3000 node scripts/ux-sweep.mjs
 *   HEADLESS=1 node scripts/ux-sweep.mjs           # CI (Cloudflare'e takılabilir)
 *
 * NEDEN VAR: `docs/UX_AUDIT.md` içindeki bulguların çoğu, gözle bakınca
 * görünmeyen ama ölçünce net olan şeylerdi — 2 px'lik yatay kayma, ekran
 * okuyucuya İngilizce konuşan bir takvim, güvenli bölgeyi aşan bir PWA ikonu.
 * Bir daha sızmalarının tek güvencesi tekrar ÖLÇMEK. Bu script o ölçümü tek
 * komuta indiriyor.
 *
 * Çıkış kodu: bir kural bozulduysa 1. Böylece bir cron ya da CI adımı buna
 * bakarak alarm üretebilir.
 */
import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "https://bagajpark.com";
const HEADLESS = process.env.HEADLESS === "1";

/** Ölçülen sayfalar. Dil × yol; hepsi misafir yüzeyi (giriş gerekmiyor). */
const SHOP_ID = process.env.SHOP_ID ?? "131bcf6d-9156-4716-8925-3b8a26c04894";

const SAYFALAR = [
  ["/tr", "ana sayfa"],
  ["/de", "ana sayfa (DE)"],
  ["/fr", "ana sayfa (FR)"],
  ["/tr/search", "arama"],
  ["/de/search", "arama (DE)"],
  ["/tr/insurance", "sigorta"],
  ["/tr/faq", "SSS"],
  ["/tr/blog", "blog"],
  ["/tr/blog/istanbul-valiz-emanet-rehberi", "blog yazısı"],
  // Farsca RTL: duzen aynalanıyor, tasma sinifi farkli davranabilir
  ["/fa", "ana sayfa (FA/RTL)"],
  ["/fa/search", "arama (FA/RTL)"],
  // Japonca da KISA yazan bir dil: dokunma hedefinin yatay ekseni burada da
  // sinaniyor (Farscada iki hata tam bu yuzden cikti).
  ["/ja", "ana sayfa (JA)"],
  ["/ja/insurance", "sigorta (JA)"],
  ["/tr/luggage-storage/istanbul", "şehir sayfası"],
  // Denetim basladiktan SONRA eklenen sayfalar: hic olculmediler.
  ["/tr/how-it-works", "nasıl çalışır"],
  ["/tr/demand", "talep haritası"],
  ["/tr/partners", "esnaf tanıtım"],
  ["/tr/contact", "iletişim"],
  // Huninin geri kalani: bu denetimde en cok hata bu ikisinden cikti.
  [`/tr/shop/${SHOP_ID}`, "dükkan detay"],
  [`/tr/checkout/${SHOP_ID}`, "checkout 1. adım"],
];

/** Sayfa içinde koşan ölçüm. Tarayıcı bağlamında çalışır. */
function olcum() {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const gorunur = (e) =>
    typeof e.checkVisibility === "function"
      ? e.checkVisibility({ checkVisibilityCSS: true })
      : true;

  // Ekran okuyucuya giden İngilizce metin (ucuncu taraf bilesenler bunu yapiyordu)
  const ingilizce = /^(zoom|reset|go to|navigation bar|toggle attribution|previous month|next month)\b/i;
  const ingilizceEtiket = [];
  for (const el of document.querySelectorAll("[aria-label],[title]")) {
    if (!gorunur(el)) continue;
    const t = (el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
    if (t && ingilizce.test(t)) ingilizceEtiket.push(t.slice(0, 40));
  }

  // Baslik ve isaret yapisi
  const basliklar = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(gorunur);
  const seviye = basliklar.map((h) => +h.tagName[1]);
  const atlama = [];
  for (let i = 1; i < seviye.length; i++) {
    if (seviye[i] - seviye[i - 1] > 1) atlama.push(`h${seviye[i - 1]}->h${seviye[i]}`);
  }

  // Dokunma hedefi: WCAG 2.2 kriteri 2.5.8 -> en az 24x24
  const kucukHedef = [];
  for (const el of document.querySelectorAll('a[href],button,select,[role="button"]')) {
    if (!gorunur(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    // sr-only atlama linki bilerek 1x1
    if (String(el.className).includes("sr-only")) continue;
    /*
      Harita atif baglantilari (MapLibre'nin kendi biçimlendirmesi) haric:
      lisans geregi gorunmek zorundalar, kucuk olmalari kutuphanenin karari ve
      bizim degistirebilecegimiz bir sey degil. Kuralin gurultu uretmemesi icin
      bilerek disarida.
    */
    if (el.closest(".maplibregl-ctrl-attrib")) continue;
    if (r.height < 24 || r.width < 24)
      kucukHedef.push(`${(el.textContent || "").trim().slice(0, 16)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }

  return {
    yatayKaydirma: de.scrollWidth - de.clientWidth,
    vw,
    h1Sayisi: basliklar.filter((h) => h.tagName === "H1").length,
    seviyeAtlamasi: [...new Set(atlama)],
    mainSayisi: document.querySelectorAll("main").length,
    etiketsizNav: [...document.querySelectorAll("nav")].filter(
      (n) => gorunur(n) && !n.getAttribute("aria-label") && !n.getAttribute("aria-labelledby"),
    ).length,
    ingilizceEtiket: [...new Set(ingilizceEtiket)].slice(0, 4),
    kucukHedef: [...new Set(kucukHedef)].slice(0, 4),
  };
}

function kurallar(ad, r, buyukMetin) {
  const hatalar = [];
  if (r.yatayKaydirma > 1) hatalar.push(`yatay kaydırma ${r.yatayKaydirma}px`);
  if (r.mainSayisi !== 1) hatalar.push(`main sayısı ${r.mainSayisi} (1 olmalı)`);
  if (r.h1Sayisi !== 1) hatalar.push(`görünür h1 sayısı ${r.h1Sayisi} (1 olmalı)`);
  if (r.seviyeAtlamasi.length) hatalar.push(`başlık atlaması ${r.seviyeAtlamasi.join(",")}`);
  if (r.etiketsizNav > 0) hatalar.push(`${r.etiketsizNav} etiketsiz nav`);
  if (r.ingilizceEtiket.length) hatalar.push(`İngilizce etiket: ${r.ingilizceEtiket.join(" | ")}`);
  // Dokunma hedefi yalnizca normal boyutta anlamli; %200'de kucullme beklenir
  if (!buyukMetin && r.kucukHedef.length) hatalar.push(`küçük hedef: ${r.kucukHedef.join(" | ")}`);
  return hatalar;
}

const browser = await chromium.launch({ headless: HEADLESS });
let kirik = 0;

for (const buyukMetin of [false, true]) {
  console.log(`\n=== ${buyukMetin ? "METİN %200 (WCAG 1.4.4)" : "NORMAL BOYUT"} ===`);
  /*
    TEK BAGLAM, TEK SAYFA: her yol icin yeni bir baglam acmak tarama 16 sayfaya
    cikinca 10 dakikayi asti. Ayni baglamda kalinca cerez onayi BIR KEZ
    veriliyor (sonraki sayfalarda panel hic cikmiyor) ve tarayici acilis
    maliyeti bir kez oduniyor.
  */
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();

  for (const [yol, ad] of SAYFALAR) {
    try {
      await page.goto(BASE + yol, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch {
      /* yavaş yükleme ölçümü engellemesin */
    }
    await page.waitForTimeout(2200);
    const kabul = page.locator("button").filter({ hasText: /kabul|akzeptier|accept|受け入|پذیرش/i }).first();
    if (await kabul.count()) {
      await kabul.click().catch(() => {});
      await page.waitForTimeout(600);
    }
    if (buyukMetin) {
      await page.addStyleTag({ content: "html{font-size:32px !important}" });
      await page.waitForTimeout(700);
    }
    const r = await page.evaluate(olcum);

    /*
      Cloudflare bot dogrulamasi: bassiz olmayan tarayicida bile ara sira
      "Click to reveal" ara sayfasi cikiyor. O sayfa bizim isaretlerimizi
      tasimadigi icin butun kurallari birden bozuyor ve GERCEK bir regresyon
      gibi gorunuyor. Yanlis alarm uretmemek icin atlaniyor -- ama sessizce
      degil: satirda "atlandi" yaziyor ki kapsamin daraldigi gorunsun.
    */
    const cloudflare = await page
      .evaluate(() => /cloudflare|click to reveal/i.test(document.body.innerText.slice(0, 400)))
      .catch(() => false);
    if (cloudflare) {
      console.log(`atlandı  ${yol.padEnd(16)} Cloudflare doğrulama sayfası`);
      continue;
    }

    const hatalar = kurallar(ad, r, buyukMetin);
    if (hatalar.length) kirik += 1;
    console.log(
      `${hatalar.length ? "HATA" : "  ok"}  ${yol.padEnd(16)} ${hatalar.length ? hatalar.join(" · ") : ""}`,
    );
  }
  await ctx.close();
}

await browser.close();
console.log(`\n${kirik === 0 ? "Tüm kurallar geçti." : `${kirik} sayfa/koşul kuralları bozdu.`}`);
process.exit(kirik === 0 ? 0 : 1);

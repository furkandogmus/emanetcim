/**
 * ŞEHİR BLOG YAZILARINI VERİTABANINA YAZAR (kuru çalışma VARSAYILAN).
 *
 * NE İŞE YARAR: talep testi noktası koyduğumuz her şehir aramada görünüyor ama
 * arkasında okunacak hiçbir şey yoktu. Yazı iki işi birden yapıyor — o şehri
 * arayan misafire gerçekten işe yarar bilgi veriyor (nereye bırakılır, hangi
 * saatte kapanır, hangi müze valizi içeri almaz) ve nokta sayfasına organik
 * giriş üretiyor.
 *
 * İÇERİK KODDA, VERİTABANINDA DEĞİL: yazılar `content/blog/cities/*.ts`
 * içinde durur ve buradan `BlogPost` tablosuna upsert edilir. Sebep, yönetici
 * panelinden girilen yazıların tersine bunların sürüm kontrolünde olması
 * gerektiği: 500 yazının hangi sürümünün yayında olduğunu yalnızca git
 * söyleyebilir.
 *
 * `{{img:anahtar}}` GENİŞLETMESİ burada yapılır. Ham `<img>` yazılmaz çünkü
 * `alt` metni ve telif künyesi manifestten gelmek zorunda — ikisi de
 * unutulmaya en açık iki alan.
 *
 * KULLANIM:
 *   npx tsx scripts/blog-city-posts.ts                 # kuru calisma
 *   npx tsx scripts/blog-city-posts.ts --apply
 *   npx tsx scripts/blog-city-posts.ts --apply --city ankara
 *   npx tsx scripts/blog-city-posts.ts --verify        # tutarlilik denetimi
 *   npx tsx scripts/blog-city-posts.ts --coverage      # hangi sehirde yazi yok
 *   npx tsx scripts/blog-city-posts.ts --render <slug> # govdeyi HTML olarak bas
 */

import fs from "node:fs";
import path from "node:path";
import { readPrelaunchCities } from "./prelaunch-city-index";
import type { BlogImageManifest, CityBlogEntry, CityBlogPost } from "../content/blog/types";

const ROOT = process.cwd();
const CITIES_DIR = path.join(ROOT, "content/blog/cities");
const MANIFEST_PATH = path.join(ROOT, "content/blog/images.json");

const IMAGES: BlogImageManifest = fs.existsSync(MANIFEST_PATH)
  ? (JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as BlogImageManifest)
  : {};

const AUTHOR = { tr: "BagajPark Seyahat Editörü", en: "BagajPark Travel Editor" };

/** Künye başlığı. Metin ŞABLONDA sabit: bu HTML gövdesi, i18n'li arayüz değil. */
const CREDIT_HEADING = { tr: "Fotoğraflar", en: "Photo credits" };

async function loadEntries(): Promise<CityBlogEntry[]> {
  if (!fs.existsSync(CITIES_DIR)) return [];
  const files = fs.readdirSync(CITIES_DIR).filter((f) => f.endsWith(".ts")).sort();
  const entries: CityBlogEntry[] = [];
  for (const f of files) {
    const mod = (await import(path.join(CITIES_DIR, f))) as { entry?: CityBlogEntry };
    if (!mod.entry) throw new Error(`${f}: \`export const entry\` yok`);
    entries.push(mod.entry);
  }
  return entries;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const IMG_RE = /\{\{img:([a-z0-9-]+)\}\}/g;

/**
 * Gövdedeki yer tutucuları `<figure>` bloğuna çevirir ve sonuna künye ekler.
 *
 * `loading="lazy"` kapak DIŞINDAKİ her görselde: yazı içindeki ikinci ve
 * üçüncü fotoğraf ilk ekranda değil, indirilmeleri okumayı geciktiriyordu.
 */
export function renderPost(post: CityBlogPost): string {
  const used: string[] = [];

  const body = post.body.replace(IMG_RE, (_all, key: string) => {
    const img = IMAGES[key];
    if (!img) throw new Error(`${post.slug}: gorsel anahtari manifestte yok -> ${key}`);
    used.push(key);
    const alt = escapeAttr(img.alt[post.locale]);
    const caption = escapeAttr(img.caption[post.locale]);
    return [
      `<figure>`,
      `<img src="${img.file}" alt="${alt}" loading="lazy" width="1400" height="900" />`,
      `<figcaption>${caption}</figcaption>`,
      `</figure>`,
    ].join("");
  });

  const creditKeys = [...new Set([post.cover, ...used])];
  const credits = creditKeys
    .map((k) => {
      const img = IMAGES[k];
      const label = escapeAttr(img.caption[post.locale]);
      return `<li>${label} — ${escapeAttr(img.author)}, ${escapeAttr(img.license)} (<a href="${escapeAttr(img.source)}" target="_blank">Wikimedia Commons</a>)</li>`;
    })
    .join("");

  return `${body.trim()}\n<hr />\n<h3>${CREDIT_HEADING[post.locale]}</h3>\n<ul>${credits}</ul>`;
}

type Row = { cityKey: string; post: CityBlogPost; content: string };

function collect(entries: CityBlogEntry[], cityFilter?: string): Row[] {
  const rows: Row[] = [];
  for (const e of entries) {
    if (cityFilter && e.cityKey !== cityFilter) continue;
    for (const post of e.posts) {
      rows.push({ cityKey: e.cityKey, post, content: renderPost(post) });
    }
  }
  return rows;
}

/**
 * TUTARLILIK DENETİMİ — yayına giden içeriğin sessiz hatalarını yakalar.
 * Hepsi gerçekten olabilen hatalar: aynı slug iki şehirde (`@unique` çakışır ve
 * apply yarıda kalır), yazının görseli BAŞKA şehrin fotoğrafı (tam da
 * "ilgisiz resim" durumu), gövdede hiç görsel olmaması.
 */
async function verify(): Promise<number> {
  const entries = await loadEntries();
  const cities = new Map(readPrelaunchCities().map((c) => [c.key, c]));
  let problems = 0;
  const seenSlugs = new Map<string, string>();

  for (const e of entries) {
    if (!cities.has(e.cityKey)) {
      console.log(`BILINMEYEN SEHIR   ${e.cityKey} (prelaunch-points.ts icinde yok)`);
      problems++;
    }
    const locales = new Set(e.posts.map((p) => p.locale));
    for (const l of ["tr", "en"] as const) {
      if (!locales.has(l)) {
        console.log(`DIL EKSIK          ${e.cityKey} -> ${l}`);
        problems++;
      }
    }

    for (const post of e.posts) {
      const prev = seenSlugs.get(post.slug);
      if (prev) {
        console.log(`SLUG CAKISMASI     ${post.slug} (${prev} ve ${e.cityKey})`);
        problems++;
      }
      seenSlugs.set(post.slug, e.cityKey);

      /*
        SLUG SADECE ASCII. Bu bir bicim tercihi degil: slug URL'e giriyor
        (`/tr/blog/<slug>`) ve `sóller` gibi bir harf orada yuzde-kodlamaya
        donusuyor. Sonuc paylasilan baglantida okunmayan bir dizi, arama
        motorunda ayri gorunen iki adres ve elle yazilamayan bir URL.
        Iki kez oldu (`mallorca-palma-sóller`, `medellin-...-yurüyen`), ikisi
        de gozle yakalandi -- bu satir onu mandala baglar.
      */
      if (!/^[a-z0-9-]+$/.test(post.slug)) {
        console.log(`SLUG ASCII DEGIL   ${post.slug} (${e.cityKey})`);
        problems++;
      }

      const keys = [post.cover, ...[...post.body.matchAll(IMG_RE)].map((m) => m[1])];
      if (keys.length < 2) {
        console.log(`GORSELSIZ GOVDE    ${post.slug} (gövdede {{img:...}} yok)`);
        problems++;
      }
      for (const k of keys) {
        const img = IMAGES[k];
        if (!img) {
          console.log(`GORSEL YOK         ${post.slug} -> ${k}`);
          problems++;
          continue;
        }
        if (img.cityKey !== e.cityKey) {
          console.log(`ILGISIZ GORSEL     ${post.slug} -> ${k} (${img.cityKey} sehrine ait)`);
          problems++;
        }
      }

      const words = post.body.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
      if (words < 350) {
        console.log(`KISA YAZI          ${post.slug} (${words} kelime)`);
        problems++;
      }
    }
  }

  console.log(`\nSehir: ${entries.length}   Yazi: ${entries.reduce((a, e) => a + e.posts.length, 0)}   Sorun: ${problems}`);
  return problems;
}

async function coverage() {
  const entries = await loadEntries();
  const have = new Set(entries.map((e) => e.cityKey));
  const cities = readPrelaunchCities();
  const missing = cities.filter((c) => !have.has(c.key));

  const byCountry = new Map<string, string[]>();
  for (const c of missing) {
    const list = byCountry.get(c.country) ?? [];
    list.push(c.city);
    byCountry.set(c.country, list);
  }

  console.log(`Talep testi sehri: ${cities.length}`);
  console.log(`Yazisi olan:       ${have.size}`);
  console.log(`Eksik:             ${missing.length}\n`);
  for (const [country, list] of [...byCountry].sort()) {
    console.log(`  ${country} (${list.length}): ${list.join(", ")}`);
  }
}

/**
 * `docs/BLOG_ICERIK_LISTESI.md` içindeki tabloyu üretir.
 *
 * NEDEN ELLE TUTULMUYOR: 265 satırlık bir durum tablosu elle güncellendiğinde
 * ilk atlanan satırdan sonra belgenin tamamı güvenilmez oluyor. Tablo koddan
 * türetilirse "yazısı var" sütunu her zaman diskteki gerçeği söyler.
 */
async function listMarkdown() {
  const entries = await loadEntries();
  const byCity = new Map(entries.map((e) => [e.cityKey, e]));
  const cities = readPrelaunchCities();

  const done = cities.filter((c) => byCity.has(c.key)).length;
  const posts = entries.reduce((n, e) => n + e.posts.length, 0);

  /*
    BASLIK BLOGU DA BURADAN URETILIYOR. Dosya her calistirmada bastan
    yaziliyor; elle eklenen bir giris bir sonraki uretimde silinir. O yuzden
    okuyucunun ihtiyac duydugu her sey -- sayilar, komutlar, kurallar --
    uretimin parcasi olmak zorunda.
  */
  console.log(`<!-- URETILDI: npx tsx scripts/blog-city-posts.ts --list-md -->`);
  console.log(`<!-- Elle duzenlemeyin; komutu yeniden calistirin. -->`);
  console.log("");
  console.log("# Blog içerik listesi");
  console.log("");
  console.log(`**${done}/${cities.length} şehir** · **${posts} yazı** (her şehir için TR + EN)`);
  console.log("");
  console.log("## Komutlar");
  console.log("");
  console.log("```bash");
  console.log("npx tsx scripts/blog-city-posts.ts --verify    # govde, slug, gorsel ve uzunluk denetimi");
  console.log("npx tsx scripts/blog-city-posts.ts             # kuru calisma: neyin yazilacagini gosterir");
  console.log("npx tsx scripts/blog-city-posts.ts --apply     # veritabanina yazar (canli Postgres ister)");
  console.log("npx tsx scripts/blog-city-posts.ts --list-md   # bu dosyayi uretir");
  console.log("npx tsx scripts/blog-images.ts --verify        # gorsel dosyalari ve kredi bilgileri");
  console.log("```");
  console.log("");
  console.log("## Kurallar");
  console.log("");
  console.log("1. Yazi govdesinde ham `<img>` yok; `{{img:anahtar}}` yer tutucusu kullanilir. Alt metin");
  console.log("   ve foto krediti `content/blog/images.json`den gelir, boylece unutulamaz.");
  console.log("2. Gorselin `cityKey`i yazinin `cityKey`i ile ayni olmali. Dogrulayici aksini");
  console.log("   \"ILGISIZ GORSEL\" diye raporlar.");
  console.log("3. Ticari olmayan / turetilemez lisansli gorsel indirilmez; indirme adiminda reddedilir.");
  console.log("4. Her gorsel dosyasi 400 KB'i asmaz ve WebP'e cevrilir.");
  console.log("5. Slug yalnizca `[a-z0-9-]` icerir. Turkce harf URL'de yuzde-kodlamaya donusur.");
  console.log("6. Gorsel anahtari da yalnizca `[a-z0-9-]` icerir; yer tutucu regexi onu arar.");
  console.log("7. Turkce yazilar en az 350 kelime. Kisa kalan yaziya dolgu degil, o sehre ait");
  console.log("   gercek bir bolum eklenir.");
  console.log("");
  console.log("## Şehirler");
  console.log("");
  console.log("| # | Ülke | Şehir | Anahtar | Nokta | Durum | TR slug | EN slug |");
  console.log("|---|---|---|---|---|---|---|---|");
  cities.forEach((c, i) => {
    const e = byCity.get(c.key);
    const tr = e?.posts.find((p) => p.locale === "tr")?.slug ?? "";
    const en = e?.posts.find((p) => p.locale === "en")?.slug ?? "";
    const state = e ? "yayında" : "—";
    console.log(`| ${i + 1} | ${c.country} | ${c.city} | \`${c.key}\` | ${c.points.length} | ${state} | ${tr} | ${en} |`);
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const cityIdx = argv.indexOf("--city");
  const cityFilter = cityIdx !== -1 ? argv[cityIdx + 1] : undefined;

  if (argv.includes("--verify")) {
    process.exitCode = (await verify()) > 0 ? 1 : 0;
    return;
  }
  if (argv.includes("--coverage")) {
    await coverage();
    return;
  }
  if (argv.includes("--list-md")) {
    await listMarkdown();
    return;
  }
  if (argv.includes("--render")) {
    const slug = argv[argv.indexOf("--render") + 1];
    const row = collect(await loadEntries()).find((r) => r.post.slug === slug);
    if (!row) throw new Error(`slug bulunamadi: ${slug}`);
    console.log(row.content);
    return;
  }

  const rows = collect(await loadEntries(), cityFilter);
  if (rows.length === 0) {
    console.log("Yazilacak yazi yok.");
    return;
  }

  const prisma = (await import("../src/lib/db")).default;
  let created = 0;
  let updated = 0;

  for (const { post, content } of rows) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: post.slug }, select: { id: true } });
    const data = {
      locale: post.locale,
      title: post.title,
      excerpt: post.excerpt,
      coverImage: IMAGES[post.cover].file,
      authorName: post.authorName ?? AUTHOR[post.locale],
      isPublished: true,
      content,
    };
    if (existing) {
      updated++;
      console.log(`  guncelle  ${post.locale}  ${post.slug}`);
      if (apply) await prisma.blogPost.update({ where: { slug: post.slug }, data });
    } else {
      created++;
      console.log(`  OLUSTUR   ${post.locale}  ${post.slug}`);
      if (apply) await prisma.blogPost.create({ data: { ...data, slug: post.slug } });
    }
  }

  console.log(`\nOlusturulacak: ${created}   Guncellenecek: ${updated}`);
  if (!apply) console.log("Yazmak icin: --apply");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

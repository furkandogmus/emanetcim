/**
 * BLOG GÖRSELLERİNİ WIKIMEDIA COMMONS'TAN İNDİRİR, KÜÇÜLTÜR, KÜNYESİNİ YAZAR.
 *
 * NEDEN COMMONS: "ilgisiz resim kullanma" kuralının tek makinece doğrulanabilir
 * hali, görselin nereden geldiğini bilmek. Stok fotoğraf arama sonucu "İzmir"
 * yazıp Yunanistan sahili döndürebilir ve bunu hiçbir kontrol yakalayamaz.
 * Commons'ta ise dosyanın kendi sayfası konumu, tarihi ve neyi gösterdiğini
 * söyler; `--search` sonucundaki başlık insan gözüyle seçilir ve seçim
 * manifeste kaynak URL'iyle birlikte YAZILIR. Yani her görselin nereden geldiği
 * ve neden o şehre ait olduğu geriye doğru okunabilir.
 *
 * NEDEN YERELE İNDİRİLİYOR: `next.config.ts` yalnızca `images.unsplash.com`
 * uzak deseni tanıyor ve upload.wikimedia.org'a sıcak bağlantı vermek hem o
 * listeyi büyütür hem de Wikimedia'nın altyapısına trafik yıkar. İndirilen
 * dosya `public/images/blog/` altında durur; boyut disiplini için 1400px
 * genişlik / WebP q72 (tipik 80-140 KB).
 *
 * LİSANS: Commons görsellerinin çoğu CC BY-SA'dır — ATIFSIZ KULLANIM İHLALDİR.
 * Bu yüzden `author`/`license`/`source` manifestte ZORUNLU alan; yazının sonuna
 * künye bloğunu `scripts/blog-city-posts.ts` otomatik basar. Künyeyi yazarın
 * hatırlamasına bırakmak, unutulacağı anlamına gelirdi.
 *
 * KULLANIM:
 *   npx tsx scripts/blog-images.ts --search "Ankara castle"
 *   npx tsx scripts/blog-images.ts --add ankara-kale \
 *     --file "File:Ankara Kalesi 01.jpg" --city ankara \
 *     --alt-tr "Ankara Kalesi surları" --alt-en "Walls of Ankara Castle" \
 *     --caption-tr "Ankara Kalesi" --caption-en "Ankara Castle"
 *   npx tsx scripts/blog-images.ts --verify
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { BlogImage, BlogImageManifest } from "../content/blog/types";

/** Script her zaman depo kökünden çalıştırılır (`npx tsx scripts/...`). */
const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "content/blog/images.json");
const OUT_DIR = path.join(ROOT, "public/images/blog");

/**
 * Wikimedia her isteğe kendini tanıtan bir User-Agent bekliyor; genel tarayıcı
 * dizesiyle gelen otomatik trafiği hız sınırına takıyor.
 * https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy
 */
const UA = "BagajParkBlogImages/1.0 (https://bagajpark.com; hello@bagajpark.com)";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

function readManifest(): BlogImageManifest {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as BlogImageManifest;
}

function writeManifest(m: BlogImageManifest) {
  const sorted = Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}

async function api(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = new URL(COMMONS_API);
  for (const [k, v] of Object.entries({ ...params, format: "json", origin: "*" })) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}: ${url}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Commons'ta dosya arar. Sonuç insan gözüyle seçilir — otomatik seçim YOK. */
async function search(query: string, limit = 12) {
  const data = await api({
    action: "query",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "400",
  });
  const pages = (data.query as { pages?: Record<string, RawPage> } | undefined)?.pages ?? {};
  const rows = Object.values(pages);
  if (rows.length === 0) {
    console.log("Sonuc yok.");
    return;
  }
  for (const p of rows) {
    const info = p.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const license = meta.LicenseShortName?.value ?? "?";
    const dims = info ? `${info.width}x${info.height}` : "?";
    console.log(`\n  ${p.title}`);
    console.log(`    lisans: ${license}   olcu: ${dims}`);
    console.log(`    ${info?.descriptionurl ?? ""}`);
  }
}

/**
 * Bir Commons KATEGORİSİNDEKİ dosyaları listeler.
 *
 * NEDEN AYRI BİR MOD: serbest metin arama küçük şehirlerde çöküyor. "Samsun"
 * sorgusu şehir manzarası yerine bir hastane sevk defterinin fotoğrafını
 * döndürüyor, çünkü arama dosya ADINDA eşleşme arıyor. Kategori ise şehri
 * bilen biri tarafından elle kürelenmiş: `Category:Samsun` içindekiler
 * gerçekten Samsun'a ait.
 */
async function category(name: string, limit = 30) {
  const title = name.startsWith("Category:") ? name : `Category:${name}`;
  const data = await api({
    action: "query",
    generator: "categorymembers",
    gcmtitle: title,
    gcmtype: "file",
    gcmlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
  });
  const pages = (data.query as { pages?: Record<string, RawPage> } | undefined)?.pages ?? {};
  const rows = Object.values(pages);
  if (rows.length === 0) {
    console.log(`Kategori bos ya da yok: ${title}`);
    return;
  }
  for (const p of rows) {
    const info = p.imageinfo?.[0];
    if (!info) continue;
    // Yatay olmayanlar kapak icin uygun degil; yine de listeleniyor ama isaretli.
    const shape = info.width >= info.height ? "yatay" : "DIKEY";
    console.log(`\n  ${p.title}`);
    console.log(`    ${stripHtml(info.extmetadata?.LicenseShortName?.value ?? "?")}   ${info.width}x${info.height} ${shape}`);
  }
}

type RawPage = {
  title: string;
  imageinfo?: Array<{
    url: string;
    width: number;
    height: number;
    descriptionurl: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Lisans kabul listesi. Ticari kullanıma kapalı (`NonCommercial`) ya da türev
 * yasaklayan (`NoDerivatives`) bir görsel BagajPark blogunda kullanılamaz;
 * script bunu indirmeden önce reddeder.
 */
const BLOCKED_LICENSE = /noncommercial|no derivatives|\bnd\b|\bnc\b|fair use|non-free/i;

async function add(opts: {
  key: string;
  file: string;
  city: string;
  altTr: string;
  altEn: string;
  captionTr: string;
  captionEn: string;
  width: number;
}) {
  const data = await api({
    action: "query",
    titles: opts.file,
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
  });
  const pages = (data.query as { pages?: Record<string, RawPage> } | undefined)?.pages ?? {};
  const page = Object.values(pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`Commons'ta bulunamadi: ${opts.file}`);

  const meta = info.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value ?? "");
  const author = stripHtml(meta.Artist?.value ?? "") || "Bilinmiyor";
  if (!license) throw new Error(`Lisans bilgisi yok: ${opts.file}`);
  if (BLOCKED_LICENSE.test(license)) {
    throw new Error(`Ticari kullanima kapali lisans (${license}): ${opts.file}`);
  }

  const res = await fetch(info.url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Indirilemedi ${res.status}: ${info.url}`);
  const buf = Buffer.from(await res.arrayBuffer());

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${opts.key}.webp`);
  await sharp(buf)
    .rotate()
    .resize({ width: opts.width, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(outFile);

  const kb = Math.round(fs.statSync(outFile).size / 1024);

  const manifest = readManifest();
  const entry: BlogImage = {
    file: `/images/blog/${opts.key}.webp`,
    alt: { tr: opts.altTr, en: opts.altEn },
    caption: { tr: opts.captionTr, en: opts.captionEn },
    source: info.descriptionurl,
    author,
    license,
    cityKey: opts.city,
  };
  manifest[opts.key] = entry;
  writeManifest(manifest);

  console.log(`OK  ${opts.key}  ${kb} KB  ${license}  (${author})`);
  console.log(`    ${info.descriptionurl}`);
}

/** Manifest ↔ disk ↔ yazılarda kullanılan anahtarlar arasındaki sapmayı ölçer. */
function verify(): number {
  const manifest = readManifest();
  let problems = 0;

  for (const [key, img] of Object.entries(manifest)) {
    const abs = path.join(ROOT, "public", img.file.replace(/^\//, ""));
    if (!fs.existsSync(abs)) {
      console.log(`EKSIK DOSYA   ${key} -> ${img.file}`);
      problems++;
      continue;
    }
    const kb = fs.statSync(abs).size / 1024;
    if (kb > 400) {
      console.log(`BUYUK         ${key}  ${Math.round(kb)} KB`);
      problems++;
    }
    if (!img.author || !img.license || !img.source) {
      console.log(`KUNYE EKSIK   ${key}`);
      problems++;
    }
  }

  // Yetim dosya: diskte var, manifestte yok. Bu bir sızıntı değil ama künyesiz
  // bir görselin yayına girmesinin en kolay yolu.
  if (fs.existsSync(OUT_DIR)) {
    const known = new Set(Object.keys(manifest).map((k) => `${k}.webp`));
    for (const f of fs.readdirSync(OUT_DIR)) {
      if (f.startsWith(".")) continue;
      if (!known.has(f)) {
        console.log(`MANIFESTTE YOK ${f}`);
        problems++;
      }
    }
  }

  console.log(`\nGorsel: ${Object.keys(manifest).length}   Sorun: ${problems}`);
  return problems;
}

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) {
    if (fallback !== undefined) return fallback;
    throw new Error(`--${name} zorunlu`);
  }
  return process.argv[i + 1];
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes("--search")) {
    await search(arg("search"));
    return;
  }

  if (argv.includes("--category")) {
    await category(arg("category"));
    return;
  }

  if (argv.includes("--verify")) {
    process.exitCode = verify() > 0 ? 1 : 0;
    return;
  }

  if (argv.includes("--add")) {
    await add({
      key: arg("add"),
      file: arg("file"),
      city: arg("city"),
      altTr: arg("alt-tr"),
      altEn: arg("alt-en"),
      captionTr: arg("caption-tr"),
      captionEn: arg("caption-en"),
      width: Number(arg("width", "1400")),
    });
    return;
  }

  console.log(`Kullanim:
  --search "<sorgu>"                    Commons'ta aday dosya arar
  --category "<Kategori>"               bir Commons kategorisindeki dosyalari listeler
                                        (kucuk sehirlerde aramadan cok daha iyi)
  --add <anahtar> --file "File:X.jpg" --city <sehir>
        --alt-tr .. --alt-en .. --caption-tr .. --caption-en .. [--width 1400]
  --verify                              manifest / disk / kunye denetimi`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

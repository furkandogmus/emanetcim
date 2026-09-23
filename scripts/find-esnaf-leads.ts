/**
 * Herhangi bir pilot bölgede potansiyel esnaf adaylarını Google Places API
 * (New) Text Search ile TEK istekte toplu çeker: isim, adres, telefon,
 * website, puan, açık/kapalı durumu. Çıktı CSV — telesatış/kapı ziyareti için
 * arama listesi (bkz. docs/pazarlama_stratejisi_tr.md § 1.2).
 *
 * E-POSTA YOK: Places API hiçbir SKU'da e-posta alanı döndürmez. Bu bilinçli
 * bir kapsam kararı — plan zaten telefonla arama öngörüyor, e-posta gerekmiyor.
 *
 * MALİYET: Enterprise SKU alanları (telefon, website, puan, saat) ayda 1.000
 * çağrıya kadar ücretsiz (2026-09, developers.google.com/maps/billing-and-pricing/pricing).
 * Her şehir koşusu ~6 kategori × 1 istek = ~6 çağrı; dört şehir toplasa bile
 * ~24 çağrı, aylık ücretsiz kotanın çok altında.
 *
 * KULLANIM:
 *   GOOGLE_MAPS_API_KEY .env'de olmalı (bkz. scripts/README.md § "Places API anahtarı").
 *   npx tsx scripts/find-esnaf-leads.ts
 *   npx tsx scripts/find-esnaf-leads.ts --city "Bodrum" --lat 37.0344 --lng 27.4305 --limit 30
 *   npx tsx scripts/find-esnaf-leads.ts --city "İzmir Merkez" --lat 38.4192 --lng 27.1287 --radius 1500 --limit 30
 *   npx tsx scripts/find-esnaf-leads.ts --out scripts/output/ozel-liste.csv
 *
 * --city verilmezse varsayılan Galata/Karaköy pilot hattı kullanılır.
 * --limit verilirse çıktı bulunan ilk N benzersiz adayla sınırlanır (kategori
 * sırasına göre) — API'den daha fazlası zaten gelmiş olsa da CSV'ye o kadarı yazılır.
 * --categories virgülle ayrılmış liste verilirse varsayılan CATEGORIES'i geçici
 * olarak değiştirir, örn. rakip/mevcut valiz-emanet noktalarını bulmak için:
 *   npx tsx scripts/find-esnaf-leads.ts --city Bodrum --lat 37.0344 --lng 27.4305 \
 *     --categories "valiz emanet,eşya emanet,bagaj depolama,luggage storage" --out scripts/output/rakip-bodrum.csv
 *
 * ÇIKTI git'e girmez (bkz. .gitignore: scripts/output/) — toplu iş yeri
 * verisi (telefon dahil) tekrar üretilebilir bir yan çıktı, kaynak değil.
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Galata Kulesi çevresi — pilot hat (bkz. docs/pazarlama_stratejisi_tr.md § 1.1)
const DEFAULT_CITY = "Galata-Karaköy";
const DEFAULT_CENTER = { latitude: 41.0256, longitude: 28.9744 };
const DEFAULT_RADIUS_METERS = 700;

// Stratejide adı geçen dört tip + iki ek aday tipi (turist trafiği yüksek,
// vitrin alanı var → valiz bırakma/QR köşesi için uygun).
const CATEGORIES = [
  "kafe",
  "hediyelik eşya dükkanı",
  "nöbetçi eczane",
  "büfe",
  "kuru temizleme",
  "otel resepsiyonu",
];

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.regularOpeningHours",
  "places.googleMapsUri",
].join(",");

interface PlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  regularOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
}

async function searchCategory(
  category: string,
  city: string,
  center: { latitude: number; longitude: number },
  radiusMeters: number,
): Promise<PlaceResult[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY as string,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: `${category} ${city}`,
      languageCode: "tr",
      maxResultCount: 20,
      locationBias: {
        circle: { center, radius: radiusMeters },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Places API ${response.status} (${category}): ${body}`);
  }

  const data = (await response.json()) as { places?: PlaceResult[] };
  return data.places ?? [];
}

function toCsvRow(fields: string[]): string {
  return fields
    .map((field) => `"${field.replaceAll('"', '""')}"`)
    .join(",");
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  if (!API_KEY) {
    console.error(
      "GOOGLE_MAPS_API_KEY eksik. scripts/README.md § 'Places API anahtarı' adımlarını izleyin.",
    );
    process.exit(1);
  }

  const city = readArg("--city") ?? DEFAULT_CITY;
  const lat = readArg("--lat");
  const lng = readArg("--lng");
  const center = lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : DEFAULT_CENTER;
  const radiusMeters = Number(readArg("--radius") ?? DEFAULT_RADIUS_METERS);
  const limitArg = readArg("--limit");
  const limit = limitArg ? Number(limitArg) : undefined;
  const categoriesArg = readArg("--categories");
  const categories = categoriesArg ? categoriesArg.split(",").map((c) => c.trim()) : CATEGORIES;
  const outPath = readArg("--out") ?? `scripts/output/esnaf-leads-${slugify(city)}.csv`;

  const seen = new Map<string, { category: string; place: PlaceResult }>();

  for (const category of categories) {
    if (limit !== undefined && seen.size >= limit) break;
    console.log(`Aranıyor: ${category} (${city})...`);
    const places = await searchCategory(category, city, center, radiusMeters);
    for (const place of places) {
      if (limit !== undefined && seen.size >= limit) break;
      if (!seen.has(place.id)) {
        seen.set(place.id, { category, place });
      }
    }
    // Enterprise SKU rate-limit'e karşı istekler arasında kısa bekleme.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const rows = [
    toCsvRow([
      "kategori",
      "isim",
      "adres",
      "telefon",
      "website",
      "puan",
      "degerlendirme_sayisi",
      "durum",
      "acik_mi",
      "google_maps_url",
      "place_id",
    ]),
  ];

  for (const { category, place } of seen.values()) {
    rows.push(
      toCsvRow([
        category,
        place.displayName?.text ?? "",
        place.formattedAddress ?? "",
        place.nationalPhoneNumber ?? "",
        place.websiteUri ?? "",
        place.rating?.toString() ?? "",
        place.userRatingCount?.toString() ?? "",
        place.businessStatus ?? "",
        place.regularOpeningHours?.openNow === undefined
          ? ""
          : place.regularOpeningHours.openNow
            ? "açık"
            : "kapalı",
        place.googleMapsUri ?? "",
        place.id,
      ]),
    );
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, rows.join("\n"), "utf-8");

  console.log(`${seen.size} benzersiz aday (${city}) → ${outPath}`);
  const missingPhone = [...seen.values()].filter((entry) => !entry.place.nationalPhoneNumber).length;
  if (missingPhone > 0) {
    console.log(`Uyarı: ${missingPhone} aday telefon numarasız (site/adres üzerinden ulaşılabilir).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

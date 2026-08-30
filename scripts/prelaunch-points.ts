/**
 * Talep testi noktalarını oluşturur / günceller.
 *
 * NE İŞE YARAR: bir şehirde esnafla anlaşmadan önce orada müşteri olup
 * olmadığını ölçmek. Nokta aramada normal görünür; misafir rezervasyona
 * kalkıştığı an "burası yakında açılıyor, haber verelim" görür. Ölçülen şey
 * `shop_view` (sunucu), `prelaunch_booking_attempt` (istemci) ve
 * `PrelaunchInterest` (e-posta) — üçü birlikte nokta bazında talep haritası.
 *
 * REZERVASYON ALMAZ: `isPrelaunch = true` olan bir dükkana rezervasyon yazmayı
 * `createInitialBooking` sunucu tarafında reddeder. Yani hiçbir yoldan, olmayan
 * bir adrese onaylanmış rezervasyon üretilemez.
 *
 * KULLANIM (kuru çalışma VARSAYILAN — hiçbir şey yazmaz):
 *   npx tsx scripts/prelaunch-points.ts
 *   npx tsx scripts/prelaunch-points.ts --apply
 *   npx tsx scripts/prelaunch-points.ts --apply --city istanbul
 *   npx tsx scripts/prelaunch-points.ts --close istanbul-sultanahmet   # noktayı kaldır
 *
 * KOORDİNATLAR YAKLAŞIKTIR: her biri ilgili turistik noktanın merkezine yakın
 * bir değerdir, gerçek bir dükkan adresi değildir. Amaç "bu semtte talep var
 * mı" sorusunu ölçmek; metre hassasiyeti gerekmiyor. Bir noktayı taşımak
 * isterseniz aşağıdaki listeyi düzenleyip `--apply` ile yeniden koşun —
 * script `slug` üzerinden eşleştirir, kopya oluşturmaz.
 */

import "dotenv/config";
// Projenin kendi istemcisi: Prisma 7 + pg Pool adaptoru burada kuruluyor
// (`src/lib/db.ts`). Ham `new PrismaClient()` bu kurulumda calismaz.
import prisma from "../src/lib/db";

type Point = {
  /** Kalıcı kimlik: yeniden koşulduğunda kopya değil GÜNCELLEME yapılır. */
  slug: string;
  name: string;
  city: string;
  district: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

/**
 * Şehir başına 5 turistik nokta.
 *
 * Seçim ölçütü: yüksek bagajlı yaya trafiği — tren/otobüs terminali, meydan,
 * müze aksı, sahil promenadı, tarihi merkez. Talep testi tam olarak buralarda
 * anlamlıdır; bir konut mahallesine konan nokta hiçbir şey ölçmez.
 */
const POINTS: Point[] = [
  // --- İstanbul ---
  { slug: "istanbul-sultanahmet", name: "Sultanahmet Emanet Noktası", city: "İstanbul", district: "Sultanahmet", country: "TR", latitude: 41.0055, longitude: 28.9769, timezone: "Europe/Istanbul" },
  { slug: "istanbul-taksim", name: "Taksim Emanet Noktası", city: "İstanbul", district: "Taksim", country: "TR", latitude: 41.0370, longitude: 28.9850, timezone: "Europe/Istanbul" },
  { slug: "istanbul-kadikoy", name: "Kadıköy Emanet Noktası", city: "İstanbul", district: "Kadıköy", country: "TR", latitude: 40.9900, longitude: 29.0270, timezone: "Europe/Istanbul" },
  { slug: "istanbul-eminonu", name: "Eminönü Emanet Noktası", city: "İstanbul", district: "Eminönü", country: "TR", latitude: 41.0170, longitude: 28.9700, timezone: "Europe/Istanbul" },
  { slug: "istanbul-besiktas", name: "Beşiktaş Emanet Noktası", city: "İstanbul", district: "Beşiktaş", country: "TR", latitude: 41.0430, longitude: 29.0060, timezone: "Europe/Istanbul" },

  // --- Ankara ---
  { slug: "ankara-ulus", name: "Ulus Emanet Noktası", city: "Ankara", district: "Ulus", country: "TR", latitude: 39.9420, longitude: 32.8540, timezone: "Europe/Istanbul" },
  { slug: "ankara-kizilay", name: "Kızılay Emanet Noktası", city: "Ankara", district: "Kızılay", country: "TR", latitude: 39.9200, longitude: 32.8540, timezone: "Europe/Istanbul" },
  { slug: "ankara-anitkabir", name: "Anıtkabir Emanet Noktası", city: "Ankara", district: "Tandoğan", country: "TR", latitude: 39.9250, longitude: 32.8370, timezone: "Europe/Istanbul" },
  { slug: "ankara-gar", name: "Ankara Gar Emanet Noktası", city: "Ankara", district: "Altındağ", country: "TR", latitude: 39.9370, longitude: 32.8420, timezone: "Europe/Istanbul" },
  { slug: "ankara-kavaklidere", name: "Kavaklıdere Emanet Noktası", city: "Ankara", district: "Kavaklıdere", country: "TR", latitude: 39.9070, longitude: 32.8620, timezone: "Europe/Istanbul" },

  // --- İzmir ---
  { slug: "izmir-konak", name: "Konak Emanet Noktası", city: "İzmir", district: "Konak", country: "TR", latitude: 38.4190, longitude: 27.1280, timezone: "Europe/Istanbul" },
  { slug: "izmir-alsancak", name: "Alsancak Emanet Noktası", city: "İzmir", district: "Alsancak", country: "TR", latitude: 38.4370, longitude: 27.1430, timezone: "Europe/Istanbul" },
  { slug: "izmir-kordon", name: "Kordon Emanet Noktası", city: "İzmir", district: "Alsancak", country: "TR", latitude: 38.4320, longitude: 27.1390, timezone: "Europe/Istanbul" },
  { slug: "izmir-kemeralti", name: "Kemeraltı Emanet Noktası", city: "İzmir", district: "Konak", country: "TR", latitude: 38.4180, longitude: 27.1330, timezone: "Europe/Istanbul" },
  { slug: "izmir-basmane", name: "Basmane Emanet Noktası", city: "İzmir", district: "Konak", country: "TR", latitude: 38.4200, longitude: 27.1420, timezone: "Europe/Istanbul" },

  // --- Antalya ---
  { slug: "antalya-kaleici", name: "Kaleiçi Emanet Noktası", city: "Antalya", district: "Kaleiçi", country: "TR", latitude: 36.8850, longitude: 30.7050, timezone: "Europe/Istanbul" },
  { slug: "antalya-konyaalti", name: "Konyaaltı Emanet Noktası", city: "Antalya", district: "Konyaaltı", country: "TR", latitude: 36.8600, longitude: 30.6390, timezone: "Europe/Istanbul" },
  { slug: "antalya-lara", name: "Lara Emanet Noktası", city: "Antalya", district: "Lara", country: "TR", latitude: 36.8560, longitude: 30.7860, timezone: "Europe/Istanbul" },
  { slug: "antalya-otogar", name: "Antalya Otogar Emanet Noktası", city: "Antalya", district: "Kepez", country: "TR", latitude: 36.9260, longitude: 30.6600, timezone: "Europe/Istanbul" },
  { slug: "antalya-marina", name: "Antalya Marina Emanet Noktası", city: "Antalya", district: "Muratpaşa", country: "TR", latitude: 36.8830, longitude: 30.7010, timezone: "Europe/Istanbul" },

  // --- Bodrum ---
  { slug: "bodrum-merkez", name: "Bodrum Merkez Emanet Noktası", city: "Bodrum", district: "Merkez", country: "TR", latitude: 37.0350, longitude: 27.4300, timezone: "Europe/Istanbul" },
  { slug: "bodrum-marina", name: "Bodrum Marina Emanet Noktası", city: "Bodrum", district: "Merkez", country: "TR", latitude: 37.0320, longitude: 27.4240, timezone: "Europe/Istanbul" },
  { slug: "bodrum-gumbet", name: "Gümbet Emanet Noktası", city: "Bodrum", district: "Gümbet", country: "TR", latitude: 37.0300, longitude: 27.4030, timezone: "Europe/Istanbul" },
  { slug: "bodrum-yalikavak", name: "Yalıkavak Emanet Noktası", city: "Bodrum", district: "Yalıkavak", country: "TR", latitude: 37.1070, longitude: 27.2900, timezone: "Europe/Istanbul" },
  { slug: "bodrum-otogar", name: "Bodrum Otogar Emanet Noktası", city: "Bodrum", district: "Merkez", country: "TR", latitude: 37.0370, longitude: 27.4290, timezone: "Europe/Istanbul" },

  // --- Mekke ---
  { slug: "mekke-haram", name: "Mekke Harem Emanet Noktası", city: "Mekke", district: "Al Haram", country: "SA", latitude: 21.4225, longitude: 39.8262, timezone: "Asia/Riyadh" },
  { slug: "mekke-ajyad", name: "Ajyad Emanet Noktası", city: "Mekke", district: "Ajyad", country: "SA", latitude: 21.4160, longitude: 39.8290, timezone: "Asia/Riyadh" },
  { slug: "mekke-misfalah", name: "Misfalah Emanet Noktası", city: "Mekke", district: "Misfalah", country: "SA", latitude: 21.4130, longitude: 39.8190, timezone: "Asia/Riyadh" },
  { slug: "mekke-aziziyah", name: "Aziziyah Emanet Noktası", city: "Mekke", district: "Aziziyah", country: "SA", latitude: 21.4020, longitude: 39.8710, timezone: "Asia/Riyadh" },
  { slug: "mekke-jabal-omar", name: "Jabal Omar Emanet Noktası", city: "Mekke", district: "Jabal Omar", country: "SA", latitude: 21.4190, longitude: 39.8220, timezone: "Asia/Riyadh" },

  // --- Medine ---
  { slug: "medine-nabawi", name: "Mescid-i Nebevi Emanet Noktası", city: "Medine", district: "Al Haram", country: "SA", latitude: 24.4672, longitude: 39.6112, timezone: "Asia/Riyadh" },
  { slug: "medine-quba", name: "Kuba Emanet Noktası", city: "Medine", district: "Quba", country: "SA", latitude: 24.4390, longitude: 39.6170, timezone: "Asia/Riyadh" },
  { slug: "medine-markaziyah", name: "Markaziyah Emanet Noktası", city: "Medine", district: "Markaziyah", country: "SA", latitude: 24.4700, longitude: 39.6100, timezone: "Asia/Riyadh" },
  { slug: "medine-uhud", name: "Uhud Emanet Noktası", city: "Medine", district: "Uhud", country: "SA", latitude: 24.5060, longitude: 39.6130, timezone: "Asia/Riyadh" },
  { slug: "medine-otogar", name: "Medine Terminal Emanet Noktası", city: "Medine", district: "Markaziyah", country: "SA", latitude: 24.4630, longitude: 39.6000, timezone: "Asia/Riyadh" },

  // --- Amsterdam ---
  { slug: "amsterdam-centraal", name: "Amsterdam Centraal Emanet Noktası", city: "Amsterdam", district: "Centrum", country: "NL", latitude: 52.3790, longitude: 4.9000, timezone: "Europe/Amsterdam" },
  { slug: "amsterdam-museumplein", name: "Museumplein Emanet Noktası", city: "Amsterdam", district: "Zuid", country: "NL", latitude: 52.3580, longitude: 4.8810, timezone: "Europe/Amsterdam" },
  { slug: "amsterdam-dam", name: "Dam Meydanı Emanet Noktası", city: "Amsterdam", district: "Centrum", country: "NL", latitude: 52.3730, longitude: 4.8930, timezone: "Europe/Amsterdam" },
  { slug: "amsterdam-jordaan", name: "Jordaan Emanet Noktası", city: "Amsterdam", district: "Jordaan", country: "NL", latitude: 52.3740, longitude: 4.8810, timezone: "Europe/Amsterdam" },
  { slug: "amsterdam-zuid", name: "Amsterdam Zuid Emanet Noktası", city: "Amsterdam", district: "Zuid", country: "NL", latitude: 52.3390, longitude: 4.8730, timezone: "Europe/Amsterdam" },

  // --- Londra ---
  { slug: "londra-kings-cross", name: "King's Cross Emanet Noktası", city: "Londra", district: "Camden", country: "GB", latitude: 51.5320, longitude: -0.1240, timezone: "Europe/London" },
  { slug: "londra-victoria", name: "Victoria Emanet Noktası", city: "Londra", district: "Westminster", country: "GB", latitude: 51.4950, longitude: -0.1440, timezone: "Europe/London" },
  { slug: "londra-paddington", name: "Paddington Emanet Noktası", city: "Londra", district: "Westminster", country: "GB", latitude: 51.5150, longitude: -0.1760, timezone: "Europe/London" },
  { slug: "londra-liverpool-street", name: "Liverpool Street Emanet Noktası", city: "Londra", district: "City of London", country: "GB", latitude: 51.5180, longitude: -0.0810, timezone: "Europe/London" },
  { slug: "londra-southbank", name: "South Bank Emanet Noktası", city: "Londra", district: "Lambeth", country: "GB", latitude: 51.5060, longitude: -0.1160, timezone: "Europe/London" },

  // --- Madrid ---
  { slug: "madrid-atocha", name: "Atocha Emanet Noktası", city: "Madrid", district: "Retiro", country: "ES", latitude: 40.4070, longitude: -3.6900, timezone: "Europe/Madrid" },
  { slug: "madrid-sol", name: "Puerta del Sol Emanet Noktası", city: "Madrid", district: "Centro", country: "ES", latitude: 40.4170, longitude: -3.7030, timezone: "Europe/Madrid" },
  { slug: "madrid-gran-via", name: "Gran Vía Emanet Noktası", city: "Madrid", district: "Centro", country: "ES", latitude: 40.4200, longitude: -3.7050, timezone: "Europe/Madrid" },
  { slug: "madrid-chamartin", name: "Chamartín Emanet Noktası", city: "Madrid", district: "Chamartín", country: "ES", latitude: 40.4720, longitude: -3.6830, timezone: "Europe/Madrid" },
  { slug: "madrid-prado", name: "Prado Emanet Noktası", city: "Madrid", district: "Retiro", country: "ES", latitude: 40.4140, longitude: -3.6920, timezone: "Europe/Madrid" },
];

/**
 * Noktaların sahibi olacak kullanıcı.
 *
 * Shop.ownerId zorunlu. Bu noktalar bir esnafa ait DEĞİL — platformun kendi
 * ölçüm kayıtları. Ayrı bir kullanıcıda toplanmaları, gerçek partner
 * sayılarını ve `partnerReachability` sağlık kontrolünü kirletmemelerini
 * sağlıyor (o kontrol `OPERATING_SHOP_FILTER` kullanıyor, prelaunch hariç).
 */
const OWNER_EMAIL = "prelaunch@bagajpark.com";

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    apply: argv.includes("--apply"),
    city: argv.includes("--city") ? argv[argv.indexOf("--city") + 1] : null,
    close: argv.includes("--close") ? argv[argv.indexOf("--close") + 1] : null,
  };
}

async function main() {
  const args = parseArgs();

  if (args.close) {
    const shop = await prisma.shop.findFirst({
      where: { description: { contains: `[prelaunch:${args.close}]` } },
      select: { id: true, name: true, isPrelaunch: true },
    });
    if (!shop) {
      console.error(`Nokta bulunamadi: ${args.close}`);
      process.exit(1);
    }
    console.log(`${args.apply ? "KAPATILIYOR" : "[kuru] kapatilacak"}: ${shop.name}`);
    if (args.apply) {
      await prisma.shop.update({
        where: { id: shop.id },
        data: { isActive: false },
      });
    }
    return;
  }

  const selected = args.city
    ? POINTS.filter((p) => p.slug.startsWith(`${args.city}-`))
    : POINTS;

  if (selected.length === 0) {
    console.error(`Hicbir nokta eslesmedi (--city ${args.city}).`);
    process.exit(1);
  }

  console.log(
    `${selected.length} nokta, ${new Set(selected.map((p) => p.city)).size} sehir` +
      (args.apply ? "" : "  [KURU CALISMA -- hicbir sey yazilmaz]"),
  );

  let owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!owner && args.apply) {
    owner = await prisma.user.create({
      data: { email: OWNER_EMAIL, name: "BagajPark Talep Testi", role: "PARTNER" },
    });
  }

  let created = 0;
  let updated = 0;

  for (const p of selected) {
    // Slug'i aciklamaya gomuyoruz: Shop'ta ayri bir slug sutunu yok ve talep
    // testi icin sema degistirmek yerine mevcut alani isaretlemek yeterli.
    const marker = `[prelaunch:${p.slug}]`;
    const existing = await prisma.shop.findFirst({
      where: { description: { contains: marker } },
      select: { id: true },
    });

    const data = {
      name: p.name,
      city: p.city,
      district: p.district,
      address: `${p.district}, ${p.city}`,
      latitude: p.latitude,
      longitude: p.longitude,
      timezone: p.timezone,
      isPrelaunch: true,
      isActive: true,
      isTest: false,
      description: marker,
    };

    if (existing) {
      updated++;
      console.log(`  guncelle  ${p.slug.padEnd(28)} ${p.name}`);
      if (args.apply) {
        await prisma.shop.update({ where: { id: existing.id }, data });
      }
    } else {
      created++;
      console.log(`  OLUSTUR   ${p.slug.padEnd(28)} ${p.name}`);
      if (args.apply && owner) {
        await prisma.shop.create({ data: { ...data, ownerId: owner.id } });
      }
    }
  }

  console.log(`\nOlusturulacak: ${created}   Guncellenecek: ${updated}`);
  if (!args.apply) {
    console.log("Yazmak icin: --apply");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

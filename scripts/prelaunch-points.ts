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
 *   npx tsx scripts/prelaunch-points.ts --apply --city istanbul   # tek şehir
 *   npx tsx scripts/prelaunch-points.ts --list                    # sadece listele
 *   npx tsx scripts/prelaunch-points.ts --verify                  # koordinat denetimi
 *   npx tsx scripts/prelaunch-points.ts --close istanbul-sultanahmet
 *
 * `--city` argümanı aşağıdaki `key` alanıdır (slug öneki değil). Fark önemli:
 * liste yüzlerce noktaya çıktığında "önek eşleşmesi" iki şehri sessizce
 * birbirine karıştırabilirdi; `key` ile eşleşme ya tamdır ya yoktur.
 *
 * KOORDİNATLAR NEREDEN GELDİ: tahmin edilmediler. Çoğu için 2026-08-30'da bir
 * yer adı sorgusu (ör. "Sultanahmet Meydanı, Fatih, İstanbul") Nominatim'e ileri
 * geocode ettirildi ve dönen değer buraya yazıldı; ülke kodu tutmayan sonuçlar
 * sorgusu düzeltilerek yeniden çözüldü. Bir kısmı (Londra/Paris/Roma/Barselona/
 * Amsterdam/Berlin/Lizbon/New York/Los Angeles/Dubai'ye sonradan eklenen
 * noktalar) elle verildi. İki kaynağı da aynı kapı denetliyor: `--verify`.
 * Yine de bunlar ilgili semtin merkezine yakın değerlerdir, gerçek bir dükkan
 * adresi DEĞİLDİR — ölçülen soru "bu semtte talep var mı", metre hassasiyeti
 * gerekmiyor.
 *
 * `--verify` bu iddiayı denetlenebilir tutar: her koordinatı ters geocode edip
 * dönen ülke kodunu `verifyCc` (yoksa `country`) ile karşılaştırır. Elle düzeltilen bir noktada
 * en sık yapılan hata (enlem/boylamı ters yazmak, işaret düşürmek) tam olarak
 * buradan yakalanır. Ağ ister, veritabanı istemez.
 *
 * BİR NOKTAYI TAŞIMAK/EKLEMEK: aşağıdaki listeyi düzenleyip `--apply` ile
 * yeniden koşun — eşleşme `slug` üzerinden yapılır, kopya oluşmaz.
 */

import "dotenv/config";

/**
 * Prisma TEMBEL yüklenir.
 *
 * Projenin kendi istemcisi (`src/lib/db.ts`, Prisma 7 + pg Pool adaptörü; ham
 * `new PrismaClient()` bu kurulumda çalışmaz) modül seviyesinde import
 * edilirse `DATABASE_URL` yokken dosya AÇILIR AÇILMAZ patlar. `--list` ve
 * `--verify` veritabanına hiç dokunmuyor; onları bir veritabanı bağlantısına
 * mecbur bırakmak, koordinat denetimini tam da en gerekli olduğu yerde
 * (bağlantısı olmayan bir makinede, gözden geçirme sırasında) kullanılamaz
 * yapardı.
 */
let prismaOpened = false;

async function getPrisma() {
  const client = (await import("../src/lib/db")).default;
  prismaOpened = true;
  return client;
}

type CityPoint = {
  /** Şehir içinde benzersiz. Kalıcı kimlik `<key>-<slug>` olarak kurulur. */
  slug: string;
  /**
   * Yerin KENDİ dilindeki adı — "Tour Eiffel", "渋谷", "المسجد الحرام".
   *
   * Türkçe egzonim yazılmaz ("Eyfel Kulesi" değil): bu ad Paris'te arama yapan
   * bir misafire gösteriliyor ve orada o yerin adı budur. Şehrin son eki
   * (`City.suffix`) otomatik eklenir.
   *
   * Kendi alfabesinde yazabildiğimizden EMİN olmadığımız yerlerde o ülkede
   * yaygın kullanılan Latin yazımı kullanılır — uydurma bir yerel ad, Türkçe
   * bir addan daha kötüdür.
   */
  name: string;
  district: string;
  latitude: number;
  longitude: number;
};

type City = {
  /** `--city` argümanı ve slug öneki. */
  key: string;
  city: string;
  /**
   * Ada eklenecek son ek — AYIRICI DAHİL (`name + suffix` doğrudan birleştirilir).
   *
   * NEDEN VERİDE: dükkan adı tek bir metin sütunu; misafirin diline göre
   * değişemez. O yüzden "hangi dil" sorusunun cevabı ziyaretçi değil, NOKTANIN
   * KENDİSİ: Paris'teki bir nokta Fransızca, Tokyo'daki Japonca yazılır — orada
   * tabelada okunan dil hangisiyse o. Ayırıcı da son ekin içinde, çünkü CJK ve
   * Tayca yazımında tire yabancı durur; kuralı hatırlamak yerine dizgede
   * görünür kılmak daha az hata üretir.
   */
  suffix: string;
  /** ISO 3166-1 alpha-2. Shop tablosunda karşılığı yok; `--verify` kullanıyor. */
  country: string;
  /**
   * `--verify`in beklediği ülke kodu, ISO kodundan FARKLIYSA.
   *
   * OpenStreetMap'in idari hiyerarşisi ISO 3166 ile her yerde örtüşmüyor:
   * Hong Kong ve Makao `cn`, Porto Riko `us` döner. Bunları `country` alanına
   * yazmak veriyi bozardı; doğrulamayı ISO koduna zorlamak ise her koşuda
   * yanlış alarm üretir ve kurt masalına dönüşmüş bir denetleyici hiç
   * bakılmayan bir denetleyicidir.
   */
  verifyCc?: string;
  timezone: string;
  points: CityPoint[];
};

/**
 * Nokta seçim ölçütü: yüksek bagajlı yaya trafiği — tren/otobüs terminali,
 * meydan, müze aksı, sahil promenadı, tarihi merkez, liman. Talep testi tam
 * olarak buralarda anlamlıdır; bir konut mahallesine konan nokta hiçbir şey
 * ölçmez.
 *
 * ŞEHİR SEÇİM ÖLÇÜTÜ: (a) yüksek turist/transit hacmi, (b) valizle dolaşılan
 * bir merkez, (c) hizmetin yasal/pratik olarak kurulabileceği bir yer.
 * Kapsanmayanlar bilinçlidir: aktif savaş bölgeleri, ödeme altyapısının
 * çalışmadığı ülkeler ve turist akışı valiz emanetine dönüşmeyen büyük sanayi
 * şehirleri listeye alınmadı. Bir şehri eklemek bir satır; ölçüm maliyeti
 * yok, esnaf maliyeti ancak sinyal geldikten sonra doğuyor — asimetri
 * kasıtlı.
 */
const CITIES: City[] = [

  // ===== TÜRKİYE =====
  {
    key: "istanbul", city: "İstanbul", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "sultanahmet", name: "Sultanahmet", district: "Sultanahmet", latitude: 41.00652, longitude: 28.97598 },
      { slug: "taksim", name: "Taksim", district: "Taksim", latitude: 41.03783, longitude: 28.98502 },
      { slug: "kadikoy", name: "Kadıköy", district: "Kadıköy", latitude: 40.99125, longitude: 29.0216 },
      { slug: "eminonu", name: "Eminönü", district: "Eminönü", latitude: 41.01745, longitude: 28.97078 },
      { slug: "besiktas", name: "Beşiktaş", district: "Beşiktaş", latitude: 41.0412, longitude: 29.00722 },
      { slug: "galata", name: "Galata Kulesi", district: "Beyoğlu", latitude: 41.02564, longitude: 28.97421 },
      { slug: "sirkeci", name: "Sirkeci Garı", district: "Fatih", latitude: 41.01521, longitude: 28.97635 },
      { slug: "uskudar", name: "Üsküdar", district: "Üsküdar", latitude: 41.01646, longitude: 29.02518 },
      { slug: "otogar", name: "İstanbul Otogarı", district: "Bayrampaşa", latitude: 41.03708, longitude: 28.89423 },
      { slug: "ortakoy", name: "Ortaköy", district: "Beşiktaş", latitude: 41.04285, longitude: 29.00753 },
    ],
  },
  {
    key: "ankara", city: "Ankara", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "ulus", name: "Ulus", district: "Ulus", latitude: 39.94166, longitude: 32.85487 },
      { slug: "kizilay", name: "Kızılay", district: "Kızılay", latitude: 39.92099, longitude: 32.85402 },
      { slug: "anitkabir", name: "Anıtkabir", district: "Tandoğan", latitude: 39.92674, longitude: 32.83656 },
      { slug: "gar", name: "Ankara Gar", district: "Altındağ", latitude: 39.93604, longitude: 32.8438 },
      { slug: "kavaklidere", name: "Kavaklıdere", district: "Kavaklıdere", latitude: 39.91335, longitude: 32.85785 },
      { slug: "asti", name: "AŞTİ Otogar", district: "Söğütözü", latitude: 39.91818, longitude: 32.81074 },
    ],
  },
  {
    key: "izmir", city: "İzmir", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "konak", name: "Konak", district: "Konak", latitude: 38.419, longitude: 27.12863 },
      { slug: "alsancak", name: "Alsancak", district: "Alsancak", latitude: 38.4392, longitude: 27.14378 },
      { slug: "kordon", name: "Kordon", district: "Alsancak", latitude: 38.43535, longitude: 27.13989 },
      { slug: "kemeralti", name: "Kemeraltı", district: "Konak", latitude: 38.41874, longitude: 27.13075 },
      { slug: "basmane", name: "Basmane Garı", district: "Konak", latitude: 38.42253, longitude: 27.14361 },
    ],
  },
  {
    key: "antalya", city: "Antalya", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "kaleici", name: "Kaleiçi", district: "Kaleiçi", latitude: 36.88408, longitude: 30.70788 },
      { slug: "konyaalti", name: "Konyaaltı", district: "Konyaaltı", latitude: 36.86477, longitude: 30.64493 },
      { slug: "lara", name: "Lara", district: "Lara", latitude: 36.84933, longitude: 30.8345 },
      { slug: "otogar", name: "Antalya Otogarı", district: "Kepez", latitude: 36.91918, longitude: 30.66398 },
      { slug: "marina", name: "Antalya Marina", district: "Muratpaşa", latitude: 36.88657, longitude: 30.70302 },
    ],
  },
  {
    key: "bodrum", city: "Bodrum", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Bodrum Merkez", district: "Merkez", latitude: 37.03177, longitude: 27.4291 },
      { slug: "marina", name: "Bodrum Marina", district: "Merkez", latitude: 37.03413, longitude: 27.42423 },
      { slug: "gumbet", name: "Gümbet", district: "Gümbet", latitude: 37.03319, longitude: 27.40497 },
      { slug: "yalikavak", name: "Yalıkavak", district: "Yalıkavak", latitude: 37.10562, longitude: 27.29306 },
      { slug: "otogar", name: "Bodrum Otogarı", district: "Merkez", latitude: 37.06387, longitude: 27.46362 },
    ],
  },
  {
    key: "bursa", city: "Bursa", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "ulucami", name: "Ulu Cami", district: "Osmangazi", latitude: 40.18257, longitude: 29.0675 },
      { slug: "cumalikizik", name: "Cumalıkızık", district: "Yıldırım", latitude: 40.17521, longitude: 29.17269 },
      { slug: "uludag", name: "Uludağ Teleferik", district: "Yıldırım", latitude: 40.18257, longitude: 29.0675 },
      { slug: "otogar", name: "Bursa Otogarı", district: "Osmangazi", latitude: 40.26591, longitude: 29.05259 },
    ],
  },
  {
    key: "adana", city: "Adana", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Taşköprü", district: "Seyhan", latitude: 36.98402, longitude: 35.33288 },
      { slug: "otogar", name: "Adana Otogarı", district: "Seyhan", latitude: 36.98636, longitude: 35.32529 },
    ],
  },
  {
    key: "gaziantep", city: "Gaziantep", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "kale", name: "Gaziantep Kalesi", district: "Şahinbey", latitude: 37.06646, longitude: 37.38321 },
      { slug: "zeugma", name: "Zeugma Müzesi", district: "Şehitkamil", latitude: 37.07558, longitude: 37.38561 },
    ],
  },
  {
    key: "konya", city: "Konya", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "mevlana", name: "Mevlâna Müzesi", district: "Karatay", latitude: 37.87096, longitude: 32.50571 },
      { slug: "gar", name: "Konya YHT Garı", district: "Selçuklu", latitude: 37.87273, longitude: 32.49244 },
    ],
  },
  {
    key: "trabzon", city: "Trabzon", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "meydan", name: "Trabzon Meydan", district: "Ortahisar", latitude: 41.00533, longitude: 39.73151 },
      { slug: "uzungol", name: "Uzungöl", district: "Çaykara", latitude: 40.61913, longitude: 40.29481 },
      { slug: "sumela", name: "Sümela Manastırı", district: "Maçka", latitude: 40.69009, longitude: 39.65837 },
    ],
  },
  {
    key: "kayseri", city: "Kayseri", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Kayseri Kalesi", district: "Melikgazi", latitude: 38.72114, longitude: 35.48942 },
      { slug: "erciyes", name: "Erciyes Kayak Merkezi", district: "Hacılar", latitude: 38.55872, longitude: 35.4778 },
    ],
  },
  {
    key: "eskisehir", city: "Eskişehir", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "odunpazari", name: "Odunpazarı", district: "Odunpazarı", latitude: 39.76511, longitude: 30.52422 },
      { slug: "gar", name: "Eskişehir Garı", district: "Tepebaşı", latitude: 39.77439, longitude: 30.51912 },
    ],
  },
  {
    key: "samsun", city: "Samsun", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Samsun Merkez", district: "İlkadım", latitude: 41.23036, longitude: 35.96833 },
    ],
  },
  {
    key: "sanliurfa", city: "Şanlıurfa", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "baliklihgol", name: "Balıklıgöl", district: "Eyyübiye", latitude: 37.14769, longitude: 38.78458 },
      { slug: "gobeklitepe", name: "Göbeklitepe", district: "Haliliye", latitude: 37.22385, longitude: 38.92209 },
    ],
  },
  {
    key: "diyarbakir", city: "Diyarbakır", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "surici", name: "Diyarbakır Surları", district: "Sur", latitude: 37.91627, longitude: 40.23714 },
    ],
  },
  {
    key: "mersin", city: "Mersin", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Mersin Marina", district: "Yenişehir", latitude: 36.77265, longitude: 34.57221 },
      { slug: "kizkalesi", name: "Kızkalesi", district: "Erdemli", latitude: 36.45678, longitude: 34.14845 },
    ],
  },
  {
    key: "kapadokya", city: "Kapadokya", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "goreme", name: "Göreme", district: "Göreme", latitude: 38.64209, longitude: 34.82962 },
      { slug: "urgup", name: "Ürgüp", district: "Ürgüp", latitude: 38.59281, longitude: 34.95946 },
      { slug: "avanos", name: "Avanos", district: "Avanos", latitude: 38.87091, longitude: 34.85367 },
      { slug: "uchisar", name: "Uçhisar", district: "Uçhisar", latitude: 38.62938, longitude: 34.80461 },
    ],
  },
  {
    key: "pamukkale", city: "Denizli", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "travertenler", name: "Pamukkale Travertenleri", district: "Pamukkale", latitude: 37.92448, longitude: 29.11901 },
      { slug: "denizli-merkez", name: "Denizli Merkez", district: "Merkezefendi", latitude: 37.82759, longitude: 29.23895 },
    ],
  },
  {
    key: "selcuk", city: "Selçuk", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "efes", name: "Efes Antik Kenti", district: "Selçuk", latitude: 37.94796, longitude: 27.3685 },
      { slug: "sirince", name: "Şirince", district: "Şirince", latitude: 37.94235, longitude: 27.43283 },
    ],
  },
  {
    key: "kusadasi", city: "Kuşadası", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "liman", name: "Kuşadası Limanı", district: "Merkez", latitude: 37.8633, longitude: 27.25545 },
      { slug: "merkez", name: "Kuşadası Merkez", district: "Merkez", latitude: 37.86324, longitude: 27.26687 },
    ],
  },
  {
    key: "cesme", city: "Çeşme", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Çeşme Merkez", district: "Merkez", latitude: 38.32358, longitude: 26.30398 },
      { slug: "alacati", name: "Alaçatı", district: "Alaçatı", latitude: 38.28476, longitude: 26.37452 },
      { slug: "ilica", name: "Ilıca", district: "Ilıca", latitude: 38.30921, longitude: 26.37725 },
    ],
  },
  {
    key: "fethiye", city: "Fethiye", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Fethiye Merkez", district: "Merkez", latitude: 36.62323, longitude: 29.10436 },
      { slug: "oludeniz", name: "Ölüdeniz", district: "Ölüdeniz", latitude: 36.57089, longitude: 29.14025 },
      { slug: "kayakoy", name: "Kayaköy", district: "Kayaköy", latitude: 36.57813, longitude: 29.08746 },
    ],
  },
  {
    key: "marmaris", city: "Marmaris", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Marmaris Merkez", district: "Merkez", latitude: 36.84454, longitude: 28.28466 },
      { slug: "icmeler", name: "İçmeler", district: "İçmeler", latitude: 36.80133, longitude: 28.23136 },
    ],
  },
  {
    key: "kas", city: "Kaş", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Kaş Merkez", district: "Merkez", latitude: 36.19938, longitude: 29.64134 },
      { slug: "kalkan", name: "Kalkan", district: "Kalkan", latitude: 36.26527, longitude: 29.41526 },
    ],
  },
  {
    key: "alanya", city: "Alanya", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "kale", name: "Alanya Kalesi", district: "Merkez", latitude: 36.53311, longitude: 31.99056 },
      { slug: "kleopatra", name: "Kleopatra Plajı", district: "Merkez", latitude: 36.5483, longitude: 31.97999 },
    ],
  },
  {
    key: "side", city: "Side", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "antik", name: "Side Antik Kenti", district: "Side", latitude: 36.78701, longitude: 31.44067 },
      { slug: "manavgat", name: "Manavgat", district: "Manavgat", latitude: 36.78701, longitude: 31.44067 },
    ],
  },
  {
    key: "kemer", city: "Kemer", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Kemer Merkez", district: "Merkez", latitude: 36.60093, longitude: 30.57176 },
    ],
  },
  {
    key: "didim", city: "Didim", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "altinkum", name: "Altınkum", district: "Altınkum", latitude: 37.36969, longitude: 27.26848 },
    ],
  },
  {
    key: "safranbolu", city: "Safranbolu", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "carsi", name: "Safranbolu Çarşı", district: "Çarşı", latitude: 41.11103, longitude: 32.61939 },
    ],
  },
  {
    key: "ayvalik", city: "Ayvalık", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Ayvalık Merkez", district: "Merkez", latitude: 39.3181, longitude: 26.69167 },
      { slug: "cunda", name: "Cunda Adası", district: "Cunda", latitude: 39.36041, longitude: 26.64734 },
    ],
  },
  {
    key: "canakkale", city: "Çanakkale", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Çanakkale Merkez", district: "Merkez", latitude: 40.05499, longitude: 26.92783 },
      { slug: "truva", name: "Truva Antik Kenti", district: "Tevfikiye", latitude: 39.95737, longitude: 26.23802 },
      { slug: "eceabat", name: "Eceabat Gelibolu", district: "Eceabat", latitude: 40.18521, longitude: 26.3591 },
      { slug: "assos", name: "Assos", district: "Behramkale", latitude: 39.60119, longitude: 26.40313 },
    ],
  },
  {
    key: "bergama", city: "Bergama", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "akropol", name: "Bergama Akropolü", district: "Bergama", latitude: 38.41925, longitude: 27.12847 },
    ],
  },
  {
    key: "mardin", city: "Mardin", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "eski-mardin", name: "Eski Mardin", district: "Artuklu", latitude: 37.31326, longitude: 40.73544 },
    ],
  },
  {
    key: "van", city: "Van", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Van Merkez", district: "İpekyolu", latitude: 38.50307, longitude: 43.3385 },
      { slug: "akdamar", name: "Akdamar Adası", district: "Gevaş", latitude: 38.3416, longitude: 43.03458 },
    ],
  },
  {
    key: "kars", city: "Kars", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Kars Merkez", district: "Merkez", latitude: 40.61347, longitude: 43.08997 },
      { slug: "ani", name: "Ani Harabeleri", district: "Ocaklı", latitude: 40.45584, longitude: 42.99795 },
    ],
  },
  {
    key: "rize", city: "Rize", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "ayder", name: "Ayder Yaylası", district: "Çamlıhemşin", latitude: 40.95252, longitude: 41.10205 },
      { slug: "merkez", name: "Rize Merkez", district: "Merkez", latitude: 41.02482, longitude: 40.51991 },
    ],
  },
  {
    key: "amasya", city: "Amasya", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Amasya Yalıboyu", district: "Merkez", latitude: 40.65695, longitude: 35.77272 },
    ],
  },
  {
    key: "adiyaman", city: "Adıyaman", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "nemrut", name: "Nemrut Dağı", district: "Kahta", latitude: 37.98032, longitude: 38.74094 },
    ],
  },
  {
    key: "datca", city: "Datça", country: "TR", suffix: " Emanet Noktası", timezone: "Europe/Istanbul",
    points: [
      { slug: "merkez", name: "Datça Merkez", district: "Merkez", latitude: 36.72634, longitude: 27.68739 },
    ],
  },

  // ===== AVRUPA =====
  {
    key: "londra", city: "London", country: "GB", suffix: " Luggage Storage", timezone: "Europe/London",
    points: [
      { slug: "kings-cross", name: "King's Cross", district: "Camden", latitude: 51.53046, longitude: -0.12326 },
      { slug: "victoria", name: "Victoria", district: "Westminster", latitude: 51.49505, longitude: -0.14485 },
      { slug: "paddington", name: "Paddington", district: "Westminster", latitude: 51.51554, longitude: -0.17555 },
      { slug: "liverpool-street", name: "Liverpool Street", district: "City of London", latitude: 51.51743, longitude: -0.08061 },
      { slug: "southbank", name: "South Bank", district: "Lambeth", latitude: 51.50653, longitude: -0.11342 },
      { slug: "london-bridge", name: "London Bridge", district: "Southwark", latitude: 51.5055, longitude: -0.0865 },
      { slug: "waterloo", name: "Waterloo", district: "Lambeth", latitude: 51.5033, longitude: -0.1132 },
      { slug: "oxford-street", name: "Oxford Street", district: "Westminster", latitude: 51.5154, longitude: -0.141 },
      { slug: "covent-garden", name: "Covent Garden", district: "Westminster", latitude: 51.5117, longitude: -0.124 },
    ],
  },
  {
    key: "amsterdam", city: "Amsterdam", country: "NL", suffix: " — Bagageopslag", timezone: "Europe/Amsterdam",
    points: [
      { slug: "centraal", name: "Amsterdam Centraal", district: "Centrum", latitude: 52.3789, longitude: 4.90058 },
      { slug: "museumplein", name: "Museumplein", district: "Zuid", latitude: 52.35727, longitude: 4.88154 },
      { slug: "dam", name: "Dam", district: "Centrum", latitude: 52.37312, longitude: 4.89235 },
      { slug: "jordaan", name: "Jordaan", district: "Jordaan", latitude: 52.37542, longitude: 4.8811 },
      { slug: "zuid", name: "Amsterdam Zuid", district: "Zuid", latitude: 52.33881, longitude: 4.87319 },
      { slug: "leidseplein", name: "Leidseplein", district: "Centrum", latitude: 52.3639, longitude: 4.881 },
      { slug: "de-pijp", name: "De Pijp", district: "Zuid", latitude: 52.3547, longitude: 4.891 },
    ],
  },
  {
    key: "madrid", city: "Madrid", country: "ES", suffix: " — Consigna de Equipaje", timezone: "Europe/Madrid",
    points: [
      { slug: "atocha", name: "Atocha", district: "Retiro", latitude: 40.40568, longitude: -3.69002 },
      { slug: "sol", name: "Puerta del Sol", district: "Centro", latitude: 40.41686, longitude: -3.70388 },
      { slug: "gran-via", name: "Gran Vía", district: "Centro", latitude: 40.42019, longitude: -3.70416 },
      { slug: "chamartin", name: "Chamartín", district: "Chamartín", latitude: 40.47206, longitude: -3.68226 },
      { slug: "prado", name: "Museo del Prado", district: "Retiro", latitude: 40.41379, longitude: -3.69204 },
    ],
  },
  {
    key: "paris", city: "Paris", country: "FR", suffix: " — Consigne à Bagages", timezone: "Europe/Paris",
    points: [
      { slug: "gare-du-nord", name: "Gare du Nord", district: "10e", latitude: 48.87957, longitude: 2.35721 },
      { slug: "eiffel", name: "Tour Eiffel", district: "7e", latitude: 48.85826, longitude: 2.2945 },
      { slug: "louvre", name: "Louvre", district: "1er", latitude: 48.86115, longitude: 2.33803 },
      { slug: "montmartre", name: "Montmartre", district: "18e", latitude: 48.88546, longitude: 2.33915 },
      { slug: "gare-de-lyon", name: "Gare de Lyon", district: "12e", latitude: 48.84438, longitude: 2.3748 },
      { slug: "montparnasse", name: "Gare Montparnasse", district: "14e", latitude: 48.8409, longitude: 2.32 },
      { slug: "chatelet", name: "Châtelet", district: "1er", latitude: 48.8583, longitude: 2.347 },
      { slug: "notre-dame", name: "Notre-Dame", district: "4e", latitude: 48.853, longitude: 2.3499 },
      { slug: "champs-elysees", name: "Champs-Élysées", district: "8e", latitude: 48.8698, longitude: 2.3075 },
    ],
  },
  {
    key: "barcelona", city: "Barcelona", country: "ES", suffix: " — Consigna de Equipaje", timezone: "Europe/Madrid",
    points: [
      { slug: "sagrada-familia", name: "Sagrada Família", district: "Eixample", latitude: 41.4035, longitude: 2.17443 },
      { slug: "ramblas", name: "La Rambla", district: "Ciutat Vella", latitude: 41.38001, longitude: 2.17442 },
      { slug: "sants", name: "Barcelona Sants", district: "Sants", latitude: 41.37901, longitude: 2.14 },
      { slug: "barceloneta", name: "Barceloneta", district: "Barceloneta", latitude: 41.37933, longitude: 2.19297 },
      { slug: "catalunya", name: "Plaça Catalunya", district: "Eixample", latitude: 41.387, longitude: 2.1701 },
      { slug: "gotic", name: "Barri Gòtic", district: "Ciutat Vella", latitude: 41.3839, longitude: 2.176 },
    ],
  },
  {
    key: "roma", city: "Roma", country: "IT", suffix: " — Deposito Bagagli", timezone: "Europe/Rome",
    points: [
      { slug: "termini", name: "Roma Termini", district: "Esquilino", latitude: 41.9012, longitude: 12.50167 },
      { slug: "kolezyum", name: "Colosseo", district: "Celio", latitude: 41.89094, longitude: 12.4919 },
      { slug: "vatikan", name: "Vaticano", district: "Prati", latitude: 41.90798, longitude: 12.45791 },
      { slug: "trastevere", name: "Trastevere", district: "Trastevere", latitude: 41.89116, longitude: 12.46685 },
      { slug: "trevi", name: "Fontana di Trevi", district: "Trevi", latitude: 41.9009, longitude: 12.4833 },
      { slug: "navona", name: "Piazza Navona", district: "Parione", latitude: 41.8992, longitude: 12.4731 },
      { slug: "spagna", name: "Piazza di Spagna", district: "Campo Marzio", latitude: 41.9059, longitude: 12.4828 },
    ],
  },
  {
    key: "berlin", city: "Berlin", country: "DE", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Berlin",
    points: [
      { slug: "hauptbahnhof", name: "Berlin Hauptbahnhof", district: "Mitte", latitude: 52.52464, longitude: 13.36986 },
      { slug: "brandenburg", name: "Brandenburger Tor", district: "Mitte", latitude: 52.51627, longitude: 13.3777 },
      { slug: "alexanderplatz", name: "Alexanderplatz", district: "Mitte", latitude: 52.52198, longitude: 13.41364 },
      { slug: "kreuzberg", name: "Kreuzberg", district: "Kreuzberg", latitude: 52.49764, longitude: 13.41191 },
      { slug: "checkpoint-charlie", name: "Checkpoint Charlie", district: "Mitte", latitude: 52.5074, longitude: 13.3903 },
      { slug: "potsdamer-platz", name: "Potsdamer Platz", district: "Mitte", latitude: 52.5096, longitude: 13.376 },
      { slug: "east-side-gallery", name: "East Side Gallery", district: "Friedrichshain", latitude: 52.505, longitude: 13.4397 },
    ],
  },
  {
    key: "milano", city: "Milano", country: "IT", suffix: " — Deposito Bagagli", timezone: "Europe/Rome",
    points: [
      { slug: "centrale", name: "Milano Centrale", district: "Centrale", latitude: 45.48588, longitude: 9.20426 },
      { slug: "duomo", name: "Duomo", district: "Centro", latitude: 45.46391, longitude: 9.19064 },
      { slug: "navigli", name: "Navigli", district: "Navigli", latitude: 45.45018, longitude: 9.1709 },
    ],
  },
  {
    key: "venedik", city: "Venezia", country: "IT", suffix: " — Deposito Bagagli", timezone: "Europe/Rome",
    points: [
      { slug: "santa-lucia", name: "Venezia Santa Lucia", district: "Cannaregio", latitude: 45.44108, longitude: 12.32103 },
      { slug: "san-marco", name: "San Marco", district: "San Marco", latitude: 45.43426, longitude: 12.33867 },
      { slug: "rialto", name: "Rialto", district: "San Polo", latitude: 45.43807, longitude: 12.33565 },
    ],
  },
  {
    key: "floransa", city: "Firenze", country: "IT", suffix: " — Deposito Bagagli", timezone: "Europe/Rome",
    points: [
      { slug: "santa-maria-novella", name: "Firenze Santa Maria Novella", district: "Centro", latitude: 43.77757, longitude: 11.24742 },
      { slug: "duomo", name: "Duomo", district: "Centro", latitude: 43.7731, longitude: 11.25657 },
      { slug: "ponte-vecchio", name: "Ponte Vecchio", district: "Oltrarno", latitude: 43.76803, longitude: 11.25316 },
    ],
  },
  {
    key: "napoli", city: "Napoli", country: "IT", suffix: " — Deposito Bagagli", timezone: "Europe/Rome",
    points: [
      { slug: "centrale", name: "Napoli Centrale", district: "Centro", latitude: 40.85302, longitude: 14.27314 },
      { slug: "spaccanapoli", name: "Spaccanapoli", district: "Centro Storico", latitude: 40.84802, longitude: 14.25418 },
    ],
  },
  {
    key: "pisa", city: "Pisa", country: "IT", suffix: " — Deposito Bagagli", timezone: "Europe/Rome",
    points: [
      { slug: "kule", name: "Torre di Pisa", district: "Centro", latitude: 43.72302, longitude: 10.39663 },
    ],
  },
  {
    key: "verona", city: "Verona", country: "IT", suffix: " — Deposito Bagagli", timezone: "Europe/Rome",
    points: [
      { slug: "arena", name: "Verona Arena", district: "Centro", latitude: 45.43902, longitude: 10.99493 },
    ],
  },
  {
    key: "bologna", city: "Bologna", country: "IT", suffix: " — Deposito Bagagli", timezone: "Europe/Rome",
    points: [
      { slug: "centrale", name: "Bologna Centrale", district: "Centro", latitude: 44.50524, longitude: 11.34761 },
    ],
  },
  {
    key: "torino", city: "Torino", country: "IT", suffix: " — Deposito Bagagli", timezone: "Europe/Rome",
    points: [
      { slug: "porta-nuova", name: "Porta Nuova", district: "Centro", latitude: 45.06189, longitude: 7.67837 },
    ],
  },
  {
    key: "palermo", city: "Palermo", country: "IT", suffix: " — Deposito Bagagli", timezone: "Europe/Rome",
    points: [
      { slug: "centrale", name: "Palermo Centrale", district: "Centro", latitude: 38.10926, longitude: 13.36748 },
    ],
  },
  {
    key: "lizbon", city: "Lisboa", country: "PT", suffix: " — Depósito de Bagagem", timezone: "Europe/Lisbon",
    points: [
      { slug: "baixa", name: "Baixa", district: "Baixa", latitude: 38.70779, longitude: -9.13655 },
      { slug: "belem", name: "Belém", district: "Belém", latitude: 38.69159, longitude: -9.21593 },
      { slug: "santa-apolonia", name: "Santa Apolónia", district: "Alfama", latitude: 38.71369, longitude: -9.12245 },
      { slug: "alfama", name: "Alfama", district: "Alfama", latitude: 38.71177, longitude: -9.12838 },
      { slug: "rossio", name: "Rossio", district: "Baixa", latitude: 38.714, longitude: -9.1399 },
      { slug: "cais-do-sodre", name: "Cais do Sodré", district: "Cais do Sodré", latitude: 38.7067, longitude: -9.1446 },
    ],
  },
  {
    key: "porto", city: "Porto", country: "PT", suffix: " — Depósito de Bagagem", timezone: "Europe/Lisbon",
    points: [
      { slug: "sao-bento", name: "São Bento", district: "Centro", latitude: 41.14469, longitude: -8.61078 },
      { slug: "ribeira", name: "Ribeira", district: "Ribeira", latitude: 41.1407, longitude: -8.6126 },
    ],
  },
  {
    key: "sevilla", city: "Sevilla", country: "ES", suffix: " — Consigna de Equipaje", timezone: "Europe/Madrid",
    points: [
      { slug: "santa-justa", name: "Sevilla Santa Justa", district: "Nervión", latitude: 37.39209, longitude: -5.97521 },
      { slug: "katedral", name: "Catedral de Sevilla", district: "Casco Antiguo", latitude: 37.38591, longitude: -5.99314 },
    ],
  },
  {
    key: "granada", city: "Granada", country: "ES", suffix: " — Consigna de Equipaje", timezone: "Europe/Madrid",
    points: [
      { slug: "alhambra", name: "La Alhambra", district: "Realejo", latitude: 37.17605, longitude: -3.58811 },
      { slug: "merkez", name: "Plaza Nueva", district: "Centro", latitude: 37.17682, longitude: -3.59601 },
    ],
  },
  {
    key: "valensiya", city: "València", country: "ES", suffix: " — Consigna de Equipaje", timezone: "Europe/Madrid",
    points: [
      { slug: "nord", name: "Estació del Nord", district: "Ciutat Vella", latitude: 39.46613, longitude: -0.37777 },
      { slug: "sanatlar-sehri", name: "Ciutat de les Arts i les Ciències", district: "Quatre Carreres", latitude: 39.45576, longitude: -0.35255 },
    ],
  },
  {
    key: "malaga", city: "Málaga", country: "ES", suffix: " — Consigna de Equipaje", timezone: "Europe/Madrid",
    points: [
      { slug: "merkez", name: "Calle Larios", district: "Centro", latitude: 36.71967, longitude: -4.4216 },
      { slug: "maria-zambrano", name: "María Zambrano", district: "Centro", latitude: 36.71162, longitude: -4.43236 },
    ],
  },
  {
    key: "bilbao", city: "Bilbao", country: "ES", suffix: " — Consigna de Equipaje", timezone: "Europe/Madrid",
    points: [
      { slug: "guggenheim", name: "Guggenheim", district: "Abando", latitude: 43.26843, longitude: -2.93406 },
    ],
  },
  {
    key: "san-sebastian", city: "San Sebastián", country: "ES", suffix: " — Consigna de Equipaje", timezone: "Europe/Madrid",
    points: [
      { slug: "parte-vieja", name: "Parte Vieja", district: "Parte Vieja", latitude: 43.32324, longitude: -1.98519 },
    ],
  },
  {
    key: "mallorca", city: "Palma", country: "ES", suffix: " — Consigna de Equipaje", timezone: "Europe/Madrid",
    points: [
      { slug: "merkez", name: "Catedral de Palma", district: "Centro", latitude: 39.56747, longitude: 2.64817 },
    ],
  },
  {
    key: "ibiza", city: "Eivissa", country: "ES", suffix: " — Consigna de Equipaje", timezone: "Europe/Madrid",
    points: [
      { slug: "merkez", name: "Dalt Vila", district: "Eivissa", latitude: 38.90739, longitude: 1.43579 },
    ],
  },
  {
    key: "viyana", city: "Wien", country: "AT", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Vienna",
    points: [
      { slug: "hauptbahnhof", name: "Wien Hauptbahnhof", district: "Favoriten", latitude: 48.18499, longitude: 16.37794 },
      { slug: "stephansplatz", name: "Stephansplatz", district: "Innere Stadt", latitude: 48.20846, longitude: 16.37204 },
      { slug: "schonbrunn", name: "Schönbrunn", district: "Hietzing", latitude: 48.18499, longitude: 16.31157 },
    ],
  },
  {
    key: "salzburg", city: "Salzburg", country: "AT", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Vienna",
    points: [
      { slug: "altstadt", name: "Altstadt Salzburg", district: "Altstadt", latitude: 47.80002, longitude: 13.04224 },
    ],
  },
  {
    key: "innsbruck", city: "Innsbruck", country: "AT", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Vienna",
    points: [
      { slug: "altstadt", name: "Altstadt Innsbruck", district: "Altstadt", latitude: 47.26857, longitude: 11.39328 },
    ],
  },
  {
    key: "prag", city: "Praha", country: "CZ", suffix: " — Úschovna Zavazadel", timezone: "Europe/Prague",
    points: [
      { slug: "hlavni-nadrazi", name: "Praha hlavní nádraží", district: "Nové Město", latitude: 50.08296, longitude: 14.43609 },
      { slug: "eski-sehir", name: "Staroměstské náměstí", district: "Staré Město", latitude: 50.08745, longitude: 14.42097 },
      { slug: "mala-strana", name: "Malá Strana", district: "Malá Strana", latitude: 50.08646, longitude: 14.40227 },
    ],
  },
  {
    key: "budapeste", city: "Budapest", country: "HU", suffix: " — Csomagmegőrző", timezone: "Europe/Budapest",
    points: [
      { slug: "keleti", name: "Budapest Keleti", district: "Józsefváros", latitude: 47.50041, longitude: 19.08398 },
      { slug: "bazilika", name: "Szent István-bazilika", district: "Belváros", latitude: 47.50078, longitude: 19.05397 },
      { slug: "buda-kalesi", name: "Budai Vár", district: "Várkerület", latitude: 47.50196, longitude: 19.03248 },
    ],
  },
  {
    key: "munih", city: "München", country: "DE", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Berlin",
    points: [
      { slug: "hauptbahnhof", name: "München Hauptbahnhof", district: "Ludwigsvorstadt", latitude: 48.14073, longitude: 11.55694 },
      { slug: "marienplatz", name: "Marienplatz", district: "Altstadt", latitude: 48.13714, longitude: 11.5754 },
    ],
  },
  {
    key: "frankfurt", city: "Frankfurt", country: "DE", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Berlin",
    points: [
      { slug: "hauptbahnhof", name: "Frankfurt Hauptbahnhof", district: "Bahnhofsviertel", latitude: 50.10665, longitude: 8.66258 },
      { slug: "romer", name: "Römer", district: "Altstadt", latitude: 50.11021, longitude: 8.68217 },
    ],
  },
  {
    key: "hamburg", city: "Hamburg", country: "DE", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Berlin",
    points: [
      { slug: "hauptbahnhof", name: "Hamburg Hauptbahnhof", district: "Mitte", latitude: 53.55298, longitude: 10.00676 },
      { slug: "reeperbahn", name: "Reeperbahn", district: "St. Pauli", latitude: 53.54964, longitude: 9.95745 },
    ],
  },
  {
    key: "koln", city: "Köln", country: "DE", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Berlin",
    points: [
      { slug: "dom", name: "Kölner Dom", district: "Altstadt", latitude: 50.9413, longitude: 6.95814 },
    ],
  },
  {
    key: "dusseldorf", city: "Düsseldorf", country: "DE", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Berlin",
    points: [
      { slug: "hauptbahnhof", name: "Düsseldorf Hauptbahnhof", district: "Stadtmitte", latitude: 51.21973, longitude: 6.7943 },
    ],
  },
  {
    key: "bruksel", city: "Bruxelles", country: "BE", suffix: " — Consigne à Bagages", timezone: "Europe/Brussels",
    points: [
      { slug: "midi", name: "Bruxelles-Midi", district: "Saint-Gilles", latitude: 50.83578, longitude: 4.33605 },
      { slug: "grand-place", name: "Grand Place", district: "Centre", latitude: 50.84671, longitude: 4.35252 },
    ],
  },
  {
    key: "brugge", city: "Brugge", country: "BE", suffix: " — Bagageopslag", timezone: "Europe/Brussels",
    points: [
      { slug: "markt", name: "Markt", district: "Centrum", latitude: 51.20871, longitude: 3.2244 },
    ],
  },
  {
    key: "anvers", city: "Antwerpen", country: "BE", suffix: " — Bagageopslag", timezone: "Europe/Brussels",
    points: [
      { slug: "centraal", name: "Antwerpen-Centraal", district: "Centrum", latitude: 51.21622, longitude: 4.42107 },
    ],
  },
  {
    key: "rotterdam", city: "Rotterdam", country: "NL", suffix: " — Bagageopslag", timezone: "Europe/Amsterdam",
    points: [
      { slug: "centraal", name: "Rotterdam Centraal", district: "Centrum", latitude: 51.92502, longitude: 4.46893 },
    ],
  },
  {
    key: "lahey", city: "Den Haag", country: "NL", suffix: " — Bagageopslag", timezone: "Europe/Amsterdam",
    points: [
      { slug: "centraal", name: "Den Haag Centraal", district: "Centrum", latitude: 52.08076, longitude: 4.32553 },
    ],
  },
  {
    key: "kopenhag", city: "København", country: "DK", suffix: " — Bagageopbevaring", timezone: "Europe/Copenhagen",
    points: [
      { slug: "hovedbanegard", name: "København H", district: "Indre By", latitude: 55.67276, longitude: 12.56468 },
      { slug: "nyhavn", name: "Nyhavn", district: "Indre By", latitude: 55.67974, longitude: 12.59089 },
    ],
  },
  {
    key: "stockholm", city: "Stockholm", country: "SE", suffix: " — Bagageförvaring", timezone: "Europe/Stockholm",
    points: [
      { slug: "centralstationen", name: "Stockholm Centralstation", district: "Norrmalm", latitude: 59.33015, longitude: 18.05821 },
      { slug: "gamla-stan", name: "Gamla Stan", district: "Gamla Stan", latitude: 59.3233, longitude: 18.067 },
    ],
  },
  {
    key: "oslo", city: "Oslo", country: "NO", suffix: " — Bagasjeoppbevaring", timezone: "Europe/Oslo",
    points: [
      { slug: "sentralstasjon", name: "Oslo S", district: "Sentrum", latitude: 59.91093, longitude: 10.75284 },
    ],
  },
  {
    key: "helsinki", city: "Helsinki", country: "FI", suffix: " — Matkatavarasäilytys", timezone: "Europe/Helsinki",
    points: [
      { slug: "rautatieasema", name: "Helsingin päärautatieasema", district: "Kluuvi", latitude: 60.17155, longitude: 24.94059 },
    ],
  },
  {
    key: "reykjavik", city: "Reykjavík", country: "IS", suffix: " — Farangursgeymsla", timezone: "Atlantic/Reykjavik",
    points: [
      { slug: "merkez", name: "Laugavegur", district: "Miðborg", latitude: 64.14554, longitude: -21.92834 },
    ],
  },
  {
    key: "dublin", city: "Dublin", country: "IE", suffix: " Luggage Storage", timezone: "Europe/Dublin",
    points: [
      { slug: "connolly", name: "Dublin Connolly", district: "North City", latitude: 53.35272, longitude: -6.24714 },
      { slug: "temple-bar", name: "Temple Bar", district: "Temple Bar", latitude: 53.3455, longitude: -6.26311 },
    ],
  },
  {
    key: "edinburgh", city: "Edinburgh", country: "GB", suffix: " Luggage Storage", timezone: "Europe/London",
    points: [
      { slug: "waverley", name: "Edinburgh Waverley", district: "Old Town", latitude: 55.9519, longitude: -3.19042 },
      { slug: "royal-mile", name: "Royal Mile", district: "Old Town", latitude: 55.94972, longitude: -3.19106 },
    ],
  },
  {
    key: "manchester", city: "Manchester", country: "GB", suffix: " Luggage Storage", timezone: "Europe/London",
    points: [
      { slug: "piccadilly", name: "Manchester Piccadilly", district: "City Centre", latitude: 53.47742, longitude: -2.23083 },
    ],
  },
  {
    key: "liverpool", city: "Liverpool", country: "GB", suffix: " Luggage Storage", timezone: "Europe/London",
    points: [
      { slug: "lime-street", name: "Liverpool Lime Street", district: "City Centre", latitude: 53.40761, longitude: -2.97759 },
    ],
  },
  {
    key: "zurih", city: "Zürich", country: "CH", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Zurich",
    points: [
      { slug: "hauptbahnhof", name: "Zürich Hauptbahnhof", district: "Kreis 1", latitude: 47.3781, longitude: 8.53936 },
    ],
  },
  {
    key: "cenevre", city: "Genève", country: "CH", suffix: " — Consigne à Bagages", timezone: "Europe/Zurich",
    points: [
      { slug: "cornavin", name: "Genève-Cornavin", district: "Cité", latitude: 46.20817, longitude: 6.1425 },
    ],
  },
  {
    key: "luzern", city: "Luzern", country: "CH", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Zurich",
    points: [
      { slug: "bahnhof", name: "Luzern Bahnhof", district: "Altstadt", latitude: 47.05024, longitude: 8.3103 },
    ],
  },
  {
    key: "interlaken", city: "Interlaken", country: "CH", suffix: " — Gepäckaufbewahrung", timezone: "Europe/Zurich",
    points: [
      { slug: "ost", name: "Interlaken Ost", district: "Interlaken", latitude: 46.69045, longitude: 7.869 },
    ],
  },
  {
    key: "varsova", city: "Warszawa", country: "PL", suffix: " — Przechowalnia Bagażu", timezone: "Europe/Warsaw",
    points: [
      { slug: "centralna", name: "Warszawa Centralna", district: "Śródmieście", latitude: 52.22882, longitude: 21.00316 },
      { slug: "stare-miasto", name: "Stare Miasto", district: "Stare Miasto", latitude: 52.2498, longitude: 21.0118 },
    ],
  },
  {
    key: "krakov", city: "Kraków", country: "PL", suffix: " — Przechowalnia Bagażu", timezone: "Europe/Warsaw",
    points: [
      { slug: "glowny", name: "Kraków Główny", district: "Stare Miasto", latitude: 50.06842, longitude: 19.94789 },
      { slug: "rynek", name: "Rynek Główny", district: "Stare Miasto", latitude: 50.0615, longitude: 19.93711 },
    ],
  },
  {
    key: "gdansk", city: "Gdańsk", country: "PL", suffix: " — Przechowalnia Bagażu", timezone: "Europe/Warsaw",
    points: [
      { slug: "glowne-miasto", name: "Główne Miasto", district: "Główne Miasto", latitude: 54.34833, longitude: 18.65384 },
    ],
  },
  {
    key: "wroclaw", city: "Wrocław", country: "PL", suffix: " — Przechowalnia Bagażu", timezone: "Europe/Warsaw",
    points: [
      { slug: "rynek", name: "Rynek", district: "Stare Miasto", latitude: 51.11004, longitude: 17.03184 },
    ],
  },
  {
    key: "atina", city: "Athens", country: "GR", suffix: " — Φύλαξη Αποσκευών", timezone: "Europe/Athens",
    points: [
      { slug: "syntagma", name: "Σύνταγμα", district: "Syntagma", latitude: 37.97552, longitude: 23.73495 },
      { slug: "akropolis", name: "Ακρόπολη", district: "Plaka", latitude: 37.97169, longitude: 23.72632 },
      { slug: "larissa", name: "Σταθμός Λαρίσης", district: "Kolonos", latitude: 37.99228, longitude: 23.72072 },
      { slug: "pire", name: "Λιμάνι Πειραιά", district: "Piraeus", latitude: 37.93914, longitude: 23.62503 },
    ],
  },
  {
    key: "selanik", city: "Thessaloniki", country: "GR", suffix: " — Φύλαξη Αποσκευών", timezone: "Europe/Athens",
    points: [
      { slug: "aristotelous", name: "Πλατεία Αριστοτέλους", district: "Kentro", latitude: 40.63234, longitude: 22.9409 },
      { slug: "gar", name: "Σταθμός Θεσσαλονίκης", district: "Kentro", latitude: 40.64511, longitude: 22.92919 },
    ],
  },
  {
    key: "santorini", city: "Santorini", country: "GR", suffix: " — Φύλαξη Αποσκευών", timezone: "Europe/Athens",
    points: [
      { slug: "fira", name: "Φηρά", district: "Fira", latitude: 36.41831, longitude: 25.42761 },
      { slug: "oia", name: "Οία", district: "Oia", latitude: 36.46221, longitude: 25.37573 },
    ],
  },
  {
    key: "mykonos", city: "Mykonos", country: "GR", suffix: " — Φύλαξη Αποσκευών", timezone: "Europe/Athens",
    points: [
      { slug: "hora", name: "Χώρα Μυκόνου", district: "Chora", latitude: 37.44504, longitude: 25.32597 },
    ],
  },
  {
    key: "girit", city: "Crete", country: "GR", suffix: " — Φύλαξη Αποσκευών", timezone: "Europe/Athens",
    points: [
      { slug: "heraklion", name: "Λιμάνι Ηρακλείου", district: "Heraklion", latitude: 35.34192, longitude: 25.14182 },
      { slug: "hanya", name: "Παλιό Λιμάνι Χανίων", district: "Chania", latitude: 35.3085, longitude: 24.46334 },
    ],
  },
  {
    key: "rodos", city: "Rhodes", country: "GR", suffix: " — Φύλαξη Αποσκευών", timezone: "Europe/Athens",
    points: [
      { slug: "eski-sehir", name: "Παλιά Πόλη Ρόδου", district: "Rhodes", latitude: 36.4489, longitude: 28.22592 },
    ],
  },
  {
    key: "dubrovnik", city: "Dubrovnik", country: "HR", suffix: " — Čuvanje Prtljage", timezone: "Europe/Zagreb",
    points: [
      { slug: "eski-sehir", name: "Stari Grad", district: "Stari Grad", latitude: 42.64134, longitude: 18.10885 },
    ],
  },
  {
    key: "split", city: "Split", country: "HR", suffix: " — Čuvanje Prtljage", timezone: "Europe/Zagreb",
    points: [
      { slug: "diocletian", name: "Dioklecijanova Palača", district: "Grad", latitude: 43.5085, longitude: 16.44025 },
      { slug: "liman", name: "Luka Split", district: "Grad", latitude: 43.16253, longitude: 16.69433 },
    ],
  },
  {
    key: "zagreb", city: "Zagreb", country: "HR", suffix: " — Čuvanje Prtljage", timezone: "Europe/Zagreb",
    points: [
      { slug: "glavni-kolodvor", name: "Zagreb Glavni Kolodvor", district: "Donji Grad", latitude: 45.80445, longitude: 15.97883 },
    ],
  },
  {
    key: "ljubljana", city: "Ljubljana", country: "SI", suffix: " — Hramba Prtljage", timezone: "Europe/Ljubljana",
    points: [
      { slug: "merkez", name: "Prešernov trg", district: "Center", latitude: 46.05003, longitude: 14.50693 },
    ],
  },
  {
    key: "bratislava", city: "Bratislava", country: "SK", suffix: " — Úschovňa Batožiny", timezone: "Europe/Bratislava",
    points: [
      { slug: "merkez", name: "Hlavné námestie", district: "Staré Mesto", latitude: 48.14347, longitude: 17.10824 },
    ],
  },
  {
    key: "bukres", city: "București", country: "RO", suffix: " — Depozit de Bagaje", timezone: "Europe/Bucharest",
    points: [
      { slug: "gara-de-nord", name: "Gara de Nord", district: "Sector 1", latitude: 44.44661, longitude: 26.07407 },
      { slug: "eski-sehir", name: "Lipscani", district: "Sector 3", latitude: 44.43181, longitude: 26.10158 },
    ],
  },
  {
    key: "brasov", city: "Brașov", country: "RO", suffix: " — Depozit de Bagaje", timezone: "Europe/Bucharest",
    points: [
      { slug: "merkez", name: "Piața Sfatului", district: "Centru", latitude: 45.6422, longitude: 25.58922 },
    ],
  },
  {
    key: "sofya", city: "Sofia", country: "BG", suffix: " — Гардероб за Багаж", timezone: "Europe/Sofia",
    points: [
      { slug: "serdika", name: "Сердика", district: "Sredets", latitude: 42.74129, longitude: 23.33856 },
      { slug: "gar", name: "Централна гара София", district: "Serdika", latitude: 42.71223, longitude: 23.32077 },
    ],
  },
  {
    key: "plovdiv", city: "Plovdiv", country: "BG", suffix: " — Гардероб за Багаж", timezone: "Europe/Sofia",
    points: [
      { slug: "eski-sehir", name: "Стария град", district: "Stariya grad", latitude: 42.14748, longitude: 24.75171 },
    ],
  },
  {
    key: "belgrad", city: "Beograd", country: "RS", suffix: " — Čuvanje Prtljage", timezone: "Europe/Belgrade",
    points: [
      { slug: "merkez", name: "Knez Mihailova", district: "Stari Grad", latitude: 44.81966, longitude: 20.45384 },
    ],
  },
  {
    key: "saraybosna", city: "Sarajevo", country: "BA", suffix: " — Čuvanje Prtljage", timezone: "Europe/Sarajevo",
    points: [
      { slug: "bascarsija", name: "Baščaršija", district: "Stari Grad", latitude: 43.85943, longitude: 18.43106 },
    ],
  },
  {
    key: "mostar", city: "Mostar", country: "BA", suffix: " — Čuvanje Prtljage", timezone: "Europe/Sarajevo",
    points: [
      { slug: "eski-kopru", name: "Stari Most", district: "Stari Grad", latitude: 43.33726, longitude: 17.81504 },
    ],
  },
  {
    key: "uskup", city: "Skopje", country: "MK", suffix: " — Чување Багаж", timezone: "Europe/Skopje",
    points: [
      { slug: "carsi", name: "Стара чаршија", district: "Čair", latitude: 42.00174, longitude: 21.43675 },
    ],
  },
  {
    key: "ohrid", city: "Ohrid", country: "MK", suffix: " — Чување Багаж", timezone: "Europe/Skopje",
    points: [
      { slug: "merkez", name: "Стар град Охрид", district: "Ohrid", latitude: 41.11702, longitude: 20.80177 },
    ],
  },
  {
    key: "tiran", city: "Tiranë", country: "AL", suffix: " — Ruajtje Bagazhesh", timezone: "Europe/Tirane",
    points: [
      { slug: "skanderbeg", name: "Sheshi Skënderbej", district: "Tirana", latitude: 41.32847, longitude: 19.81769 },
    ],
  },
  {
    key: "budva", city: "Budva", country: "ME", suffix: " — Čuvanje Prtljage", timezone: "Europe/Podgorica",
    points: [
      { slug: "eski-sehir", name: "Stari Grad Budva", district: "Stari Grad", latitude: 42.27688, longitude: 18.83799 },
    ],
  },
  {
    key: "kotor", city: "Kotor", country: "ME", suffix: " — Čuvanje Prtljage", timezone: "Europe/Podgorica",
    points: [
      { slug: "eski-sehir", name: "Stari Grad Kotor", district: "Stari Grad", latitude: 42.42506, longitude: 18.7722 },
    ],
  },
  {
    key: "riga", city: "Riga", country: "LV", suffix: " — Bagāžas Glabātuve", timezone: "Europe/Riga",
    points: [
      { slug: "vecriga", name: "Vecrīga", district: "Vecrīga", latitude: 56.94793, longitude: 24.10797 },
    ],
  },
  {
    key: "vilnius", city: "Vilnius", country: "LT", suffix: " — Bagažo Saugykla", timezone: "Europe/Vilnius",
    points: [
      { slug: "senamiestis", name: "Vilniaus senamiestis", district: "Senamiestis", latitude: 54.68282, longitude: 25.28783 },
    ],
  },
  {
    key: "tallinn", city: "Tallinn", country: "EE", suffix: " — Pagasihoid", timezone: "Europe/Tallinn",
    points: [
      { slug: "vanalinn", name: "Tallinna vanalinn", district: "Vanalinn", latitude: 59.43803, longitude: 24.74145 },
    ],
  },
  {
    key: "nice", city: "Nice", country: "FR", suffix: " — Consigne à Bagages", timezone: "Europe/Paris",
    points: [
      { slug: "promenade", name: "Promenade des Anglais", district: "Centre", latitude: 43.68599, longitude: 7.23748 },
      { slug: "gar", name: "Nice-Ville", district: "Centre", latitude: 43.70483, longitude: 7.26166 },
    ],
  },
  {
    key: "marsilya", city: "Marseille", country: "FR", suffix: " — Consigne à Bagages", timezone: "Europe/Paris",
    points: [
      { slug: "vieux-port", name: "Vieux-Port", district: "1er", latitude: 43.29458, longitude: 5.36928 },
      { slug: "saint-charles", name: "Marseille-Saint-Charles", district: "1er", latitude: 43.30323, longitude: 5.38164 },
    ],
  },
  {
    key: "lyon", city: "Lyon", country: "FR", suffix: " — Consigne à Bagages", timezone: "Europe/Paris",
    points: [
      { slug: "part-dieu", name: "Lyon Part-Dieu", district: "3e", latitude: 45.76155, longitude: 4.85932 },
      { slug: "vieux-lyon", name: "Vieux Lyon", district: "5e", latitude: 45.7625, longitude: 4.82686 },
    ],
  },
  {
    key: "bordeaux", city: "Bordeaux", country: "FR", suffix: " — Consigne à Bagages", timezone: "Europe/Paris",
    points: [
      { slug: "saint-jean", name: "Bordeaux-Saint-Jean", district: "Centre", latitude: 44.82582, longitude: -0.55607 },
    ],
  },
  {
    key: "strasbourg", city: "Strasbourg", country: "FR", suffix: " — Consigne à Bagages", timezone: "Europe/Paris",
    points: [
      { slug: "petite-france", name: "Petite France", district: "Centre", latitude: 48.58136, longitude: 7.74218 },
    ],
  },
  {
    key: "cannes", city: "Cannes", country: "FR", suffix: " — Consigne à Bagages", timezone: "Europe/Paris",
    points: [
      { slug: "croisette", name: "La Croisette", district: "Centre", latitude: 43.54821, longitude: 7.02934 },
    ],
  },
  {
    key: "monako", city: "Monako", country: "MC", suffix: " — Consigne à Bagages", timezone: "Europe/Monaco",
    points: [
      { slug: "monte-carlo", name: "Monte Carlo", district: "Monte Carlo", latitude: 43.7403, longitude: 7.42656 },
    ],
  },
  {
    key: "batum", city: "Batumi", country: "GE", suffix: " — ბარგის შენახვა", timezone: "Asia/Tbilisi",
    points: [
      { slug: "merkez", name: "ბათუმის პიაცა", district: "Batumi", latitude: 41.64959, longitude: 41.64112 },
    ],
  },
  {
    key: "tiflis", city: "Tbilisi", country: "GE", suffix: " — ბარგის შენახვა", timezone: "Asia/Tbilisi",
    points: [
      { slug: "rustaveli", name: "რუსთაველის გამზირი", district: "Mtatsminda", latitude: 41.69916, longitude: 44.79809 },
      { slug: "eski-sehir", name: "ძველი თბილისი", district: "Old Tbilisi", latitude: 41.69223, longitude: 44.80325 },
    ],
  },
  {
    key: "erivan", city: "Yerevan", country: "AM", suffix: " — Ուղեբեռի պահպանում", timezone: "Asia/Yerevan",
    points: [
      { slug: "merkez", name: "Հանրապետության հրապարակ", district: "Kentron", latitude: 40.17756, longitude: 44.51555 },
    ],
  },
  {
    key: "baku", city: "Bakı", country: "AZ", suffix: " — Baqaj Saxlama", timezone: "Asia/Baku",
    points: [
      { slug: "icerisehir", name: "İçərişəhər", district: "Sabail", latitude: 40.36596, longitude: 49.83165 },
    ],
  },

  // ===== ORTA DOĞU & KUZEY AFRİKA =====
  {
    key: "mekke", city: "Makkah", country: "SA", suffix: " — حفظ الأمتعة", timezone: "Asia/Riyadh",
    points: [
      { slug: "haram", name: "المسجد الحرام", district: "Al Haram", latitude: 21.42456, longitude: 39.82487 },
      { slug: "ajyad", name: "أجياد", district: "Ajyad", latitude: 21.41794, longitude: 39.82917 },
      { slug: "misfalah", name: "المسفلة", district: "Misfalah", latitude: 21.40501, longitude: 39.82231 },
      { slug: "aziziyah", name: "العزيزية", district: "Aziziyah", latitude: 21.27921, longitude: 40.40738 },
      { slug: "jabal-omar", name: "جبل عمر", district: "Jabal Omar", latitude: 21.41973, longitude: 39.82166 },
    ],
  },
  {
    key: "medine", city: "Madinah", country: "SA", suffix: " — حفظ الأمتعة", timezone: "Asia/Riyadh",
    points: [
      { slug: "nabawi", name: "المسجد النبوي", district: "Al Haram", latitude: 24.46868, longitude: 39.61116 },
      { slug: "quba", name: "مسجد قباء", district: "Quba", latitude: 24.43942, longitude: 39.61746 },
      { slug: "markaziyah", name: "المنطقة المركزية", district: "Markaziyah", latitude: 24.47115, longitude: 39.61112 },
      { slug: "uhud", name: "أحد", district: "Uhud", latitude: 24.52273, longitude: 39.61826 },
      { slug: "otogar", name: "محطة الحافلات", district: "Taybah", latitude: 24.47672, longitude: 39.5467 },
    ],
  },
  {
    key: "cidde", city: "Jeddah", country: "SA", suffix: " — حفظ الأمتعة", timezone: "Asia/Riyadh",
    points: [
      { slug: "balad", name: "البلد", district: "Al Balad", latitude: 21.48604, longitude: 39.1877 },
      { slug: "corniche", name: "كورنيش جدة", district: "Corniche", latitude: 21.62773, longitude: 39.10608 },
    ],
  },
  {
    key: "riyad", city: "Riyadh", country: "SA", suffix: " — حفظ الأمتعة", timezone: "Asia/Riyadh",
    points: [
      { slug: "olaya", name: "العليا", district: "Olaya", latitude: 24.68448, longitude: 46.69009 },
      { slug: "diriyah", name: "الدرعية", district: "Diriyah", latitude: 24.733, longitude: 46.57338 },
    ],
  },
  {
    key: "dubai", city: "Dubai", country: "AE", suffix: " — حفظ الأمتعة", timezone: "Asia/Dubai",
    points: [
      { slug: "deira", name: "ديرة", district: "Deira", latitude: 25.27279, longitude: 55.30533 },
      { slug: "downtown", name: "وسط مدينة دبي", district: "Downtown", latitude: 25.19703, longitude: 55.27413 },
      { slug: "marina", name: "مرسى دبي", district: "Marina", latitude: 25.07864, longitude: 55.13525 },
      { slug: "bur-dubai", name: "بر دبي", district: "Bur Dubai", latitude: 25.23559, longitude: 55.29672 },
      { slug: "dubai-mall", name: "دبي مول", district: "Downtown", latitude: 25.1985, longitude: 55.2796 },
      { slug: "jbr", name: "جي بي آر", district: "JBR", latitude: 25.078, longitude: 55.1332 },
    ],
  },
  {
    key: "abu-dabi", city: "Abu Dhabi", country: "AE", suffix: " — حفظ الأمتعة", timezone: "Asia/Dubai",
    points: [
      { slug: "merkez", name: "الكورنيش", district: "Al Markaziyah", latitude: 24.4672, longitude: 54.33357 },
      { slug: "seyh-zayed", name: "جامع الشيخ زايد", district: "Al Rawdah", latitude: 24.41245, longitude: 54.47427 },
    ],
  },
  {
    key: "sarja", city: "Sharjah", country: "AE", suffix: " — حفظ الأمتعة", timezone: "Asia/Dubai",
    points: [
      { slug: "merkez", name: "واجهة المجاز المائية", district: "Al Majaz", latitude: 24.97607, longitude: 56.2536 },
    ],
  },
  {
    key: "doha", city: "Doha", country: "QA", suffix: " — حفظ الأمتعة", timezone: "Asia/Qatar",
    points: [
      { slug: "souq-waqif", name: "سوق واقف", district: "Al Jasrah", latitude: 25.28823, longitude: 51.53322 },
      { slug: "corniche", name: "كورنيش الدوحة", district: "Corniche", latitude: 25.29425, longitude: 51.52294 },
    ],
  },
  {
    key: "kuveyt", city: "Kuwait City", country: "KW", suffix: " — حفظ الأمتعة", timezone: "Asia/Kuwait",
    points: [
      { slug: "merkez", name: "أبراج الكويت", district: "Sharq", latitude: 29.38992, longitude: 48.00329 },
    ],
  },
  {
    key: "manama", city: "Manama", country: "BH", suffix: " — حفظ الأمتعة", timezone: "Asia/Bahrain",
    points: [
      { slug: "merkez", name: "باب البحرين", district: "Manama", latitude: 26.23401, longitude: 50.57563 },
    ],
  },
  {
    key: "maskat", city: "Muscat", country: "OM", suffix: " — حفظ الأمتعة", timezone: "Asia/Muscat",
    points: [
      { slug: "mutrah", name: "سوق مطرح", district: "Muttrah", latitude: 23.61947, longitude: 58.56494 },
    ],
  },
  {
    key: "amman", city: "Amman", country: "JO", suffix: " — حفظ الأمتعة", timezone: "Asia/Amman",
    points: [
      { slug: "downtown", name: "وسط البلد", district: "Al Balad", latitude: 31.95156, longitude: 35.93319 },
      { slug: "abdali", name: "العبدلي", district: "Abdali", latitude: 31.96424, longitude: 35.90665 },
    ],
  },
  {
    key: "petra", city: "Wadi Musa", country: "JO", suffix: " — حفظ الأمتعة", timezone: "Asia/Amman",
    points: [
      { slug: "wadi-musa", name: "وادي موسى", district: "Wadi Musa", latitude: 30.3243, longitude: 35.46785 },
    ],
  },
  {
    key: "akabe", city: "Aqaba", country: "JO", suffix: " — حفظ الأمتعة", timezone: "Asia/Amman",
    points: [
      { slug: "merkez", name: "العقبة", district: "Aqaba", latitude: 29.52665, longitude: 35.00754 },
    ],
  },
  {
    key: "beyrut", city: "Beirut", country: "LB", suffix: " — حفظ الأمتعة", timezone: "Asia/Beirut",
    points: [
      { slug: "hamra", name: "الحمرا", district: "Hamra", latitude: 33.89564, longitude: 35.48226 },
      { slug: "downtown", name: "وسط بيروت", district: "Beirut Central District", latitude: 33.88923, longitude: 35.50256 },
    ],
  },
  {
    key: "kahire", city: "Cairo", country: "EG", suffix: " — حفظ الأمتعة", timezone: "Africa/Cairo",
    points: [
      { slug: "tahrir", name: "ميدان التحرير", district: "Downtown", latitude: 30.04439, longitude: 31.23575 },
      { slug: "giza", name: "أهرامات الجيزة", district: "Giza", latitude: 29.97078, longitude: 31.12423 },
      { slug: "han-el-halili", name: "خان الخليلي", district: "Al Gamaleya", latitude: 30.04894, longitude: 31.26134 },
    ],
  },
  {
    key: "iskenderiye", city: "Alexandria", country: "EG", suffix: " — حفظ الأمتعة", timezone: "Africa/Cairo",
    points: [
      { slug: "corniche", name: "كورنيش الإسكندرية", district: "Corniche", latitude: 31.26163, longitude: 29.98374 },
    ],
  },
  {
    key: "luksor", city: "Luxor", country: "EG", suffix: " — حفظ الأمتعة", timezone: "Africa/Cairo",
    points: [
      { slug: "merkez", name: "معبد الأقصر", district: "Luxor", latitude: 25.69953, longitude: 32.63907 },
    ],
  },
  {
    key: "hurgada", city: "Hurghada", country: "EG", suffix: " — حفظ الأمتعة", timezone: "Africa/Cairo",
    points: [
      { slug: "merkez", name: "مارينا الغردقة", district: "Hurghada", latitude: 27.2287, longitude: 33.84352 },
    ],
  },
  {
    key: "sarm-el-seyh", city: "Sharm El Sheikh", country: "EG", suffix: " — حفظ الأمتعة", timezone: "Africa/Cairo",
    points: [
      { slug: "naama", name: "خليج نعمة", district: "Naama Bay", latitude: 27.91127, longitude: 34.33189 },
    ],
  },
  {
    key: "marakes", city: "Marrakech", country: "MA", suffix: " — Consigne à Bagages", timezone: "Africa/Casablanca",
    points: [
      { slug: "jemaa-el-fna", name: "Jemaa el-Fna", district: "Medina", latitude: 31.62578, longitude: -7.9889 },
      { slug: "gueliz", name: "Guéliz", district: "Gueliz", latitude: 31.63219, longitude: -8.01081 },
    ],
  },
  {
    key: "kazablanka", city: "Casablanca", country: "MA", suffix: " — Consigne à Bagages", timezone: "Africa/Casablanca",
    points: [
      { slug: "merkez", name: "Mosquée Hassan II", district: "Anfa", latitude: 33.60822, longitude: -7.63247 },
    ],
  },
  {
    key: "fes", city: "Fès", country: "MA", suffix: " — Consigne à Bagages", timezone: "Africa/Casablanca",
    points: [
      { slug: "medina", name: "Fès el-Bali", district: "Fes el-Bali", latitude: 34.06069, longitude: -4.98011 },
    ],
  },
  {
    key: "tanca", city: "Tanger", country: "MA", suffix: " — Consigne à Bagages", timezone: "Africa/Casablanca",
    points: [
      { slug: "medina", name: "Médina de Tanger", district: "Medina", latitude: 35.78386, longitude: -5.81088 },
    ],
  },
  {
    key: "safsavan", city: "Chefchaouen", country: "MA", suffix: " — Consigne à Bagages", timezone: "Africa/Casablanca",
    points: [
      { slug: "medina", name: "Médina de Chefchaouen", district: "Chefchaouen", latitude: 35.16877, longitude: -5.26835 },
    ],
  },
  {
    key: "tunus", city: "Tunis", country: "TN", suffix: " — Consigne à Bagages", timezone: "Africa/Tunis",
    points: [
      { slug: "medina", name: "Médina de Tunis", district: "Medina", latitude: 36.79869, longitude: 10.17174 },
    ],
  },

  // ===== ASYA =====
  {
    key: "tokyo", city: "Tokyo", country: "JP", suffix: " 手荷物預かり", timezone: "Asia/Tokyo",
    points: [
      { slug: "shinjuku", name: "新宿", district: "Shinjuku", latitude: 35.68836, longitude: 139.69907 },
      { slug: "shibuya", name: "渋谷", district: "Shibuya", latitude: 35.6595, longitude: 139.7005 },
      { slug: "tokyo-station", name: "東京駅", district: "Chiyoda", latitude: 35.68107, longitude: 139.765 },
      { slug: "asakusa", name: "浅草", district: "Taito", latitude: 35.7134, longitude: 139.79553 },
      { slug: "ueno", name: "上野", district: "Taito", latitude: 35.71104, longitude: 139.77673 },
    ],
  },
  {
    key: "osaka", city: "Osaka", country: "JP", suffix: " 手荷物預かり", timezone: "Asia/Tokyo",
    points: [
      { slug: "umeda", name: "梅田", district: "Kita", latitude: 34.7021, longitude: 135.49395 },
      { slug: "namba", name: "難波", district: "Chuo", latitude: 34.66366, longitude: 135.50178 },
      { slug: "shin-osaka", name: "新大阪", district: "Yodogawa", latitude: 34.7329, longitude: 135.49854 },
    ],
  },
  {
    key: "kyoto", city: "Kyoto", country: "JP", suffix: " 手荷物預かり", timezone: "Asia/Tokyo",
    points: [
      { slug: "kyoto-station", name: "京都駅", district: "Shimogyo", latitude: 34.98645, longitude: 135.75868 },
      { slug: "gion", name: "祇園", district: "Higashiyama", latitude: 35.00469, longitude: 135.7784 },
      { slug: "arashiyama", name: "嵐山", district: "Ukyo", latitude: 35.01674, longitude: 135.67115 },
    ],
  },
  {
    key: "hirosima", city: "Hiroshima", country: "JP", suffix: " 手荷物預かり", timezone: "Asia/Tokyo",
    points: [
      { slug: "merkez", name: "平和記念公園", district: "Naka", latitude: 34.39317, longitude: 132.4523 },
    ],
  },
  {
    key: "nara", city: "Nara", country: "JP", suffix: " 手荷物預かり", timezone: "Asia/Tokyo",
    points: [
      { slug: "merkez", name: "奈良公園", district: "Nara", latitude: 34.6829, longitude: 135.8546 },
    ],
  },
  {
    key: "sapporo", city: "Sapporo", country: "JP", suffix: " 手荷物預かり", timezone: "Asia/Tokyo",
    points: [
      { slug: "merkez", name: "札幌駅", district: "Chuo", latitude: 43.06866, longitude: 141.35079 },
    ],
  },
  {
    key: "fukuoka", city: "Fukuoka", country: "JP", suffix: " 手荷物預かり", timezone: "Asia/Tokyo",
    points: [
      { slug: "hakata", name: "博多駅", district: "Hakata", latitude: 33.59004, longitude: 130.4199 },
    ],
  },
  {
    key: "seul", city: "Seoul", country: "KR", suffix: " 짐 보관", timezone: "Asia/Seoul",
    points: [
      { slug: "myeongdong", name: "명동", district: "Jung", latitude: 37.5609, longitude: 126.98638 },
      { slug: "hongdae", name: "홍대", district: "Mapo", latitude: 37.56668, longitude: 126.97829 },
      { slug: "gangnam", name: "강남", district: "Gangnam", latitude: 37.49483, longitude: 127.02919 },
      { slug: "seoul-station", name: "서울역", district: "Yongsan", latitude: 37.55482, longitude: 126.97222 },
    ],
  },
  {
    key: "busan", city: "Busan", country: "KR", suffix: " 짐 보관", timezone: "Asia/Seoul",
    points: [
      { slug: "haeundae", name: "해운대", district: "Haeundae", latitude: 35.15778, longitude: 129.15813 },
      { slug: "seomyeon", name: "서면", district: "Busanjin", latitude: 35.15819, longitude: 129.05945 },
    ],
  },
  {
    key: "pekin", city: "Beijing", country: "CN", suffix: " 行李寄存", timezone: "Asia/Shanghai",
    points: [
      { slug: "wangfujing", name: "王府井", district: "Dongcheng", latitude: 39.90695, longitude: 116.40528 },
      { slug: "tiananmen", name: "天安门广场", district: "Dongcheng", latitude: 39.90272, longitude: 116.39144 },
      { slug: "pekin-gar", name: "北京站", district: "Dongcheng", latitude: 39.9023, longitude: 116.42098 },
    ],
  },
  {
    key: "sanghay", city: "Shanghai", country: "CN", suffix: " 行李寄存", timezone: "Asia/Shanghai",
    points: [
      { slug: "bund", name: "外滩", district: "Huangpu", latitude: 31.23534, longitude: 121.48763 },
      { slug: "nanjing-road", name: "南京路", district: "Huangpu", latitude: 31.23047, longitude: 121.45795 },
      { slug: "hongqiao", name: "上海虹桥站", district: "Minhang", latitude: 31.19598, longitude: 121.3162 },
    ],
  },
  {
    key: "xian", city: "Xi'an", country: "CN", suffix: " 行李寄存", timezone: "Asia/Shanghai",
    points: [
      { slug: "merkez", name: "钟楼", district: "Beilin", latitude: 34.26101, longitude: 108.94234 },
    ],
  },
  {
    key: "hong-kong", city: "Hong Kong", country: "HK", verifyCc: "CN", suffix: " 行李寄存", timezone: "Asia/Hong_Kong",
    points: [
      { slug: "tsim-sha-tsui", name: "尖沙咀", district: "Yau Tsim Mong", latitude: 22.29887, longitude: 114.17412 },
      { slug: "central", name: "中環", district: "Central", latitude: 22.28183, longitude: 114.15828 },
      { slug: "mong-kok", name: "旺角", district: "Yau Tsim Mong", latitude: 22.31931, longitude: 114.16981 },
    ],
  },
  {
    key: "makao", city: "Macau", country: "MO", verifyCc: "CN", suffix: " 行李寄存", timezone: "Asia/Macau",
    points: [
      { slug: "senado", name: "議事亭前地", district: "Sé", latitude: 22.19383, longitude: 113.53999 },
    ],
  },
  {
    key: "taipei", city: "Taipei", country: "TW", suffix: " 行李寄存", timezone: "Asia/Taipei",
    points: [
      { slug: "main-station", name: "臺北車站", district: "Zhongzheng", latitude: 25.04772, longitude: 121.51711 },
      { slug: "ximending", name: "西門町", district: "Wanhua", latitude: 25.04378, longitude: 121.5074 },
      { slug: "taipei-101", name: "台北101", district: "Xinyi", latitude: 25.03384, longitude: 121.5645 },
    ],
  },
  {
    key: "bangkok", city: "Bangkok", country: "TH", suffix: " รับฝากกระเป๋า", timezone: "Asia/Bangkok",
    points: [
      { slug: "khaosan", name: "ถนนข้าวสาร", district: "Phra Nakhon", latitude: 13.75891, longitude: 100.49727 },
      { slug: "siam", name: "สยาม", district: "Pathum Wan", latitude: 13.7446, longitude: 100.5331 },
      { slug: "hua-lamphong", name: "หัวลำโพง", district: "Pathum Wan", latitude: 13.7382, longitude: 100.51654 },
      { slug: "sukhumvit", name: "สุขุมวิท", district: "Watthana", latitude: 13.73171, longitude: 100.56785 },
    ],
  },
  {
    key: "chiang-mai", city: "Chiang Mai", country: "TH", suffix: " รับฝากกระเป๋า", timezone: "Asia/Bangkok",
    points: [
      { slug: "eski-sehir", name: "เมืองเก่าเชียงใหม่", district: "Mueang", latitude: 18.78828, longitude: 98.98588 },
    ],
  },
  {
    key: "phuket", city: "Phuket", country: "TH", suffix: " รับฝากกระเป๋า", timezone: "Asia/Bangkok",
    points: [
      { slug: "patong", name: "ป่าตอง", district: "Patong", latitude: 7.89663, longitude: 98.29543 },
      { slug: "eski-sehir", name: "เมืองเก่าภูเก็ต", district: "Mueang", latitude: 7.88478, longitude: 98.38922 },
    ],
  },
  {
    key: "pattaya", city: "Pattaya", country: "TH", suffix: " รับฝากกระเป๋า", timezone: "Asia/Bangkok",
    points: [
      { slug: "merkez", name: "หาดพัทยา", district: "Bang Lamung", latitude: 12.93658, longitude: 100.88596 },
    ],
  },
  {
    key: "singapur", city: "Singapur", country: "SG", suffix: " Luggage Storage", timezone: "Asia/Singapore",
    points: [
      { slug: "orchard", name: "Orchard Road", district: "Orchard", latitude: 1.30045, longitude: 103.8416 },
      { slug: "marina-bay", name: "Marina Bay", district: "Downtown Core", latitude: 1.2837, longitude: 103.86072 },
      { slug: "chinatown", name: "Chinatown", district: "Outram", latitude: 1.27997, longitude: 103.84369 },
    ],
  },
  {
    key: "kuala-lumpur", city: "Kuala Lumpur", country: "MY", suffix: " Luggage Storage", timezone: "Asia/Kuala_Lumpur",
    points: [
      { slug: "klcc", name: "KLCC", district: "KLCC", latitude: 3.15797, longitude: 101.7112 },
      { slug: "bukit-bintang", name: "Bukit Bintang", district: "Bukit Bintang", latitude: 3.13952, longitude: 101.69377 },
      { slug: "sentral", name: "KL Sentral", district: "Brickfields", latitude: 3.13431, longitude: 101.68637 },
    ],
  },
  {
    key: "penang", city: "Penang", country: "MY", suffix: " Luggage Storage", timezone: "Asia/Kuala_Lumpur",
    points: [
      { slug: "georgetown", name: "Georgetown", district: "George Town", latitude: 5.41416, longitude: 100.32874 },
    ],
  },
  {
    key: "bali", city: "Bali", country: "ID", suffix: " — Penitipan Barang", timezone: "Asia/Makassar",
    points: [
      { slug: "kuta", name: "Kuta", district: "Kuta", latitude: -8.71821, longitude: 115.16876 },
      { slug: "ubud", name: "Ubud", district: "Ubud", latitude: -8.51702, longitude: 115.25505 },
      { slug: "seminyak", name: "Seminyak", district: "Seminyak", latitude: -8.68986, longitude: 115.16678 },
    ],
  },
  {
    key: "cakarta", city: "Jakarta", country: "ID", suffix: " — Penitipan Barang", timezone: "Asia/Jakarta",
    points: [
      { slug: "monas", name: "Monas", district: "Gambir", latitude: -6.1754, longitude: 106.82717 },
    ],
  },
  {
    key: "yogyakarta", city: "Yogyakarta", country: "ID", suffix: " — Penitipan Barang", timezone: "Asia/Jakarta",
    points: [
      { slug: "malioboro", name: "Malioboro", district: "Gedongtengen", latitude: -7.79535, longitude: 110.36728 },
    ],
  },
  {
    key: "hanoi", city: "Hanoi", country: "VN", suffix: " — Giữ Hành Lý", timezone: "Asia/Ho_Chi_Minh",
    points: [
      { slug: "eski-mahalle", name: "Phố cổ Hà Nội", district: "Hoan Kiem", latitude: 21.03878, longitude: 105.84715 },
      { slug: "gar", name: "Ga Hà Nội", district: "Hoan Kiem", latitude: 21.02423, longitude: 105.84101 },
    ],
  },
  {
    key: "ho-chi-minh", city: "Ho Chi Minh", country: "VN", suffix: " — Giữ Hành Lý", timezone: "Asia/Ho_Chi_Minh",
    points: [
      { slug: "ben-thanh", name: "Chợ Bến Thành", district: "District 1", latitude: 10.77253, longitude: 106.69804 },
      { slug: "pham-ngu-lao", name: "Phạm Ngũ Lão", district: "District 1", latitude: 10.76681, longitude: 106.6885 },
    ],
  },
  {
    key: "da-nang", city: "Da Nang", country: "VN", suffix: " — Giữ Hành Lý", timezone: "Asia/Ho_Chi_Minh",
    points: [
      { slug: "merkez", name: "Cầu Rồng", district: "Hai Chau", latitude: 16.06117, longitude: 108.2279 },
      { slug: "hoi-an", name: "Phố cổ Hội An", district: "Hoi An", latitude: 15.87795, longitude: 108.32399 },
    ],
  },
  {
    key: "siem-reap", city: "Siem Reap", country: "KH", suffix: " Luggage Storage", timezone: "Asia/Phnom_Penh",
    points: [
      { slug: "merkez", name: "Pub Street", district: "Siem Reap", latitude: 13.35479, longitude: 103.85471 },
    ],
  },
  {
    key: "phnom-penh", city: "Phnom Penh", country: "KH", suffix: " Luggage Storage", timezone: "Asia/Phnom_Penh",
    points: [
      { slug: "merkez", name: "Royal Palace", district: "Daun Penh", latitude: 11.56377, longitude: 104.93015 },
    ],
  },
  {
    key: "luang-prabang", city: "Luang Prabang", country: "LA", suffix: " Luggage Storage", timezone: "Asia/Vientiane",
    points: [
      { slug: "merkez", name: "Luang Prabang Night Market", district: "Luang Prabang", latitude: 19.88874, longitude: 102.1359 },
    ],
  },
  {
    key: "katmandu", city: "Katmandu", country: "NP", suffix: " Luggage Storage", timezone: "Asia/Kathmandu",
    points: [
      { slug: "thamel", name: "Thamel", district: "Thamel", latitude: 27.71666, longitude: 85.3127 },
    ],
  },
  {
    key: "pokhara", city: "Pokhara", country: "NP", suffix: " Luggage Storage", timezone: "Asia/Kathmandu",
    points: [
      { slug: "lakeside", name: "Lakeside", district: "Lakeside", latitude: 28.22106, longitude: 83.95831 },
    ],
  },
  {
    key: "delhi", city: "Delhi", country: "IN", suffix: " Luggage Storage", timezone: "Asia/Kolkata",
    points: [
      { slug: "connaught", name: "Connaught Place", district: "New Delhi", latitude: 28.63177, longitude: 77.21938 },
      { slug: "new-delhi-gar", name: "New Delhi Railway Station", district: "Paharganj", latitude: 28.64028, longitude: 77.22041 },
    ],
  },
  {
    key: "agra", city: "Agra", country: "IN", suffix: " Luggage Storage", timezone: "Asia/Kolkata",
    points: [
      { slug: "tac-mahal", name: "Taj Mahal", district: "Agra", latitude: 27.17501, longitude: 78.0421 },
    ],
  },
  {
    key: "jaipur", city: "Jaipur", country: "IN", suffix: " Luggage Storage", timezone: "Asia/Kolkata",
    points: [
      { slug: "merkez", name: "Hawa Mahal", district: "Jaipur", latitude: 26.92393, longitude: 75.82687 },
    ],
  },
  {
    key: "mumbai", city: "Mumbai", country: "IN", suffix: " Luggage Storage", timezone: "Asia/Kolkata",
    points: [
      { slug: "cst", name: "Chhatrapati Shivaji Terminus", district: "Fort", latitude: 18.93986, longitude: 72.83552 },
      { slug: "colaba", name: "Gateway of India", district: "Colaba", latitude: 18.92197, longitude: 72.83457 },
    ],
  },
  {
    key: "goa", city: "Goa", country: "IN", suffix: " Luggage Storage", timezone: "Asia/Kolkata",
    points: [
      { slug: "panaji", name: "Panaji", district: "Panaji", latitude: 15.49899, longitude: 73.82821 },
    ],
  },
  {
    key: "varanasi", city: "Varanasi", country: "IN", suffix: " Luggage Storage", timezone: "Asia/Kolkata",
    points: [
      { slug: "merkez", name: "Dashashwamedh Ghat", district: "Varanasi", latitude: 25.33565, longitude: 83.00763 },
    ],
  },
  {
    key: "kolombo", city: "Kolombo", country: "LK", suffix: " Luggage Storage", timezone: "Asia/Colombo",
    points: [
      { slug: "fort", name: "Colombo Fort", district: "Fort", latitude: 6.93373, longitude: 79.85008 },
    ],
  },
  {
    key: "kandy", city: "Kandy", country: "LK", suffix: " Luggage Storage", timezone: "Asia/Colombo",
    points: [
      { slug: "merkez", name: "Sri Dalada Maligawa", district: "Kandy", latitude: 7.29361, longitude: 80.64135 },
    ],
  },
  {
    key: "male", city: "Male", country: "MV", suffix: " Luggage Storage", timezone: "Indian/Maldives",
    points: [
      { slug: "merkez", name: "Malé", district: "Male", latitude: 4.17799, longitude: 73.51074 },
    ],
  },
  {
    key: "taskent", city: "Toshkent", country: "UZ", suffix: " — Yuk Saqlash", timezone: "Asia/Tashkent",
    points: [
      { slug: "merkez", name: "Amir Temur xiyoboni", district: "Yunusabad", latitude: 41.31267, longitude: 69.28327 },
    ],
  },
  {
    key: "semerkant", city: "Samarqand", country: "UZ", suffix: " — Yuk Saqlash", timezone: "Asia/Tashkent",
    points: [
      { slug: "registan", name: "Registon", district: "Samarkand", latitude: 39.65478, longitude: 66.97576 },
    ],
  },
  {
    key: "buhara", city: "Buxoro", country: "UZ", suffix: " — Yuk Saqlash", timezone: "Asia/Tashkent",
    points: [
      { slug: "merkez", name: "Labi Hovuz", district: "Bukhara", latitude: 39.77239, longitude: 64.42079 },
    ],
  },
  {
    key: "almati", city: "Almaty", country: "KZ", suffix: " — Жүк сақтау", timezone: "Asia/Almaty",
    points: [
      { slug: "merkez", name: "Panfilov Park", district: "Medeu", latitude: 43.26052, longitude: 76.95427 },
    ],
  },
  {
    key: "biskek", city: "Bishkek", country: "KG", suffix: " — Жүк сактоо", timezone: "Asia/Bishkek",
    points: [
      { slug: "merkez", name: "Ала-Тоо аянты", district: "Bishkek", latitude: 42.87613, longitude: 74.60369 },
    ],
  },
  {
    key: "manila", city: "Manila", country: "PH", suffix: " Luggage Storage", timezone: "Asia/Manila",
    points: [
      { slug: "intramuros", name: "Intramuros", district: "Intramuros", latitude: 14.59096, longitude: 120.97465 },
    ],
  },
  {
    key: "cebu", city: "Cebu", country: "PH", suffix: " Luggage Storage", timezone: "Asia/Manila",
    points: [
      { slug: "merkez", name: "Magellan's Cross", district: "Cebu City", latitude: 10.29357, longitude: 123.90196 },
    ],
  },

  // ===== AMERİKA =====
  {
    key: "new-york", city: "New York", country: "US", suffix: " Luggage Storage", timezone: "America/New_York",
    points: [
      { slug: "times-square", name: "Times Square", district: "Manhattan", latitude: 40.75701, longitude: -73.98597 },
      { slug: "penn-station", name: "Penn Station", district: "Manhattan", latitude: 40.75151, longitude: -73.99015 },
      { slug: "grand-central", name: "Grand Central", district: "Manhattan", latitude: 40.75269, longitude: -73.97725 },
      { slug: "soho", name: "SoHo", district: "Manhattan", latitude: 40.72288, longitude: -73.99875 },
      { slug: "brooklyn", name: "DUMBO", district: "Brooklyn", latitude: 40.70291, longitude: -73.99012 },
      { slug: "central-park", name: "Central Park", district: "Manhattan", latitude: 40.7829, longitude: -73.9654 },
      { slug: "lower-manhattan", name: "Lower Manhattan", district: "Manhattan", latitude: 40.7075, longitude: -74.0113 },
    ],
  },
  {
    key: "washington", city: "Washington DC", country: "US", suffix: " Luggage Storage", timezone: "America/New_York",
    points: [
      { slug: "union-station", name: "Union Station", district: "NE", latitude: 38.89777, longitude: -77.00741 },
      { slug: "national-mall", name: "National Mall", district: "NW", latitude: 38.88964, longitude: -77.02693 },
    ],
  },
  {
    key: "boston", city: "Boston", country: "US", suffix: " Luggage Storage", timezone: "America/New_York",
    points: [
      { slug: "south-station", name: "South Station", district: "Downtown", latitude: 42.35077, longitude: -71.05546 },
      { slug: "back-bay", name: "Back Bay", district: "Back Bay", latitude: 42.35071, longitude: -71.07973 },
    ],
  },
  {
    key: "chicago", city: "Chicago", country: "US", suffix: " Luggage Storage", timezone: "America/Chicago",
    points: [
      { slug: "loop", name: "The Loop", district: "Loop", latitude: 41.88258, longitude: -87.62254 },
      { slug: "union-station", name: "Union Station", district: "West Loop", latitude: 41.8787, longitude: -87.64041 },
    ],
  },
  {
    key: "los-angeles", city: "Los Angeles", country: "US", suffix: " Luggage Storage", timezone: "America/Los_Angeles",
    points: [
      { slug: "hollywood", name: "Hollywood", district: "Hollywood", latitude: 34.05369, longitude: -118.24277 },
      { slug: "santa-monica", name: "Santa Monica", district: "Santa Monica", latitude: 34.0089, longitude: -118.4974 },
      { slug: "downtown", name: "Downtown LA", district: "Downtown", latitude: 34.05606, longitude: -118.2359 },
      { slug: "venice-beach", name: "Venice Beach", district: "Venice", latitude: 33.985, longitude: -118.4695 },
      { slug: "lax", name: "LAX", district: "Westchester", latitude: 33.9416, longitude: -118.4085 },
    ],
  },
  {
    key: "san-francisco", city: "San Francisco", country: "US", suffix: " Luggage Storage", timezone: "America/Los_Angeles",
    points: [
      { slug: "union-square", name: "Union Square", district: "Downtown", latitude: 37.78794, longitude: -122.40752 },
      { slug: "fishermans-wharf", name: "Fisherman's Wharf", district: "Fisherman's Wharf", latitude: 37.80813, longitude: -122.41659 },
    ],
  },
  {
    key: "las-vegas", city: "Las Vegas", country: "US", suffix: " Luggage Storage", timezone: "America/Los_Angeles",
    points: [
      { slug: "strip", name: "Las Vegas Strip", district: "Paradise", latitude: 36.14367, longitude: -115.15749 },
    ],
  },
  {
    key: "miami", city: "Miami", country: "US", suffix: " Luggage Storage", timezone: "America/New_York",
    points: [
      { slug: "south-beach", name: "South Beach", district: "Miami Beach", latitude: 25.77443, longitude: -80.13324 },
      { slug: "downtown", name: "Downtown Miami", district: "Downtown", latitude: 25.7745, longitude: -80.192 },
    ],
  },
  {
    key: "orlando", city: "Orlando", country: "US", suffix: " Luggage Storage", timezone: "America/New_York",
    points: [
      { slug: "international-drive", name: "International Drive", district: "Orlando", latitude: 28.46498, longitude: -81.45037 },
    ],
  },
  {
    key: "seattle", city: "Seattle", country: "US", suffix: " Luggage Storage", timezone: "America/Los_Angeles",
    points: [
      { slug: "pike-place", name: "Pike Place", district: "Downtown", latitude: 47.6094, longitude: -122.34141 },
    ],
  },
  {
    key: "new-orleans", city: "New Orleans", country: "US", suffix: " Luggage Storage", timezone: "America/Chicago",
    points: [
      { slug: "french-quarter", name: "French Quarter", district: "French Quarter", latitude: 29.95949, longitude: -90.06554 },
    ],
  },
  {
    key: "san-diego", city: "San Diego", country: "US", suffix: " Luggage Storage", timezone: "America/Los_Angeles",
    points: [
      { slug: "gaslamp", name: "Gaslamp Quarter", district: "Downtown", latitude: 32.7115, longitude: -117.16014 },
    ],
  },
  {
    key: "philadelphia", city: "Philadelphia", country: "US", suffix: " Luggage Storage", timezone: "America/New_York",
    points: [
      { slug: "30th-street", name: "30th Street Station", district: "University City", latitude: 39.95572, longitude: -75.1822 },
    ],
  },
  {
    key: "toronto", city: "Toronto", country: "CA", suffix: " Luggage Storage", timezone: "America/Toronto",
    points: [
      { slug: "union-station", name: "Union Station", district: "Downtown", latitude: 43.64471, longitude: -79.38015 },
      { slug: "downtown", name: "Downtown Toronto", district: "Downtown", latitude: 43.64256, longitude: -79.38709 },
    ],
  },
  {
    key: "montreal", city: "Montreal", country: "CA", suffix: " Luggage Storage", timezone: "America/Toronto",
    points: [
      { slug: "vieux-montreal", name: "Vieux-Montréal", district: "Ville-Marie", latitude: 45.50221, longitude: -73.55541 },
    ],
  },
  {
    key: "vancouver", city: "Vancouver", country: "CA", suffix: " Luggage Storage", timezone: "America/Vancouver",
    points: [
      { slug: "downtown", name: "Downtown Vancouver", district: "Downtown", latitude: 49.28852, longitude: -123.11695 },
    ],
  },
  {
    key: "meksiko", city: "Ciudad de México", country: "MX", suffix: " — Consigna de Equipaje", timezone: "America/Mexico_City",
    points: [
      { slug: "centro-historico", name: "Centro Histórico", district: "Cuauhtémoc", latitude: 19.43265, longitude: -99.1332 },
      { slug: "roma-condesa", name: "Roma-Condesa", district: "Cuauhtémoc", latitude: 19.41832, longitude: -99.16257 },
    ],
  },
  {
    key: "cancun", city: "Cancun", country: "MX", suffix: " — Consigna de Equipaje", timezone: "America/Cancun",
    points: [
      { slug: "zona-hotelera", name: "Zona Hotelera", district: "Zona Hotelera", latitude: 21.10226, longitude: -86.76532 },
      { slug: "centro", name: "Centro", district: "Centro", latitude: 21.16683, longitude: -86.82948 },
    ],
  },
  {
    key: "playa-del-carmen", city: "Playa del Carmen", country: "MX", suffix: " — Consigna de Equipaje", timezone: "America/Cancun",
    points: [
      { slug: "quinta", name: "Quinta Avenida", district: "Centro", latitude: 20.63472, longitude: -87.06665 },
    ],
  },
  {
    key: "havana", city: "La Habana", country: "CU", suffix: " — Consigna de Equipaje", timezone: "America/Havana",
    points: [
      { slug: "habana-vieja", name: "Habana Vieja", district: "Habana Vieja", latitude: 23.13002, longitude: -82.35459 },
    ],
  },
  {
    key: "punta-cana", city: "Punta Cana", country: "DO", suffix: " — Consigna de Equipaje", timezone: "America/Santo_Domingo",
    points: [
      { slug: "bavaro", name: "Bávaro", district: "Bávaro", latitude: 18.60017, longitude: -68.41964 },
    ],
  },
  {
    key: "san-juan", city: "San Juan", country: "PR", verifyCc: "US", suffix: " — Consigna de Equipaje", timezone: "America/Puerto_Rico",
    points: [
      { slug: "viejo-san-juan", name: "Viejo San Juan", district: "Viejo San Juan", latitude: 18.38424, longitude: -66.05344 },
    ],
  },
  {
    key: "bogota", city: "Bogota", country: "CO", suffix: " — Consigna de Equipaje", timezone: "America/Bogota",
    points: [
      { slug: "candelaria", name: "La Candelaria", district: "La Candelaria", latitude: 4.62291, longitude: -74.06832 },
    ],
  },
  {
    key: "cartagena", city: "Cartagena", country: "CO", suffix: " — Consigna de Equipaje", timezone: "America/Bogota",
    points: [
      { slug: "centro", name: "Ciudad Amurallada", district: "Centro", latitude: 10.42352, longitude: -75.55106 },
    ],
  },
  {
    key: "medellin", city: "Medellin", country: "CO", suffix: " — Consigna de Equipaje", timezone: "America/Bogota",
    points: [
      { slug: "poblado", name: "El Poblado", district: "El Poblado", latitude: 6.20062, longitude: -75.56368 },
    ],
  },
  {
    key: "lima", city: "Lima", country: "PE", suffix: " — Consigna de Equipaje", timezone: "America/Lima",
    points: [
      { slug: "miraflores", name: "Miraflores", district: "Miraflores", latitude: -12.1215, longitude: -77.02591 },
    ],
  },
  {
    key: "cusco", city: "Cusco", country: "PE", suffix: " — Consigna de Equipaje", timezone: "America/Lima",
    points: [
      { slug: "plaza-de-armas", name: "Plaza de Armas", district: "Centro", latitude: -13.51677, longitude: -71.97878 },
    ],
  },
  {
    key: "quito", city: "Quito", country: "EC", suffix: " — Consigna de Equipaje", timezone: "America/Guayaquil",
    points: [
      { slug: "centro", name: "Centro Histórico", district: "Centro Histórico", latitude: -0.22016, longitude: -78.51233 },
    ],
  },
  {
    key: "santiago", city: "Santiago", country: "CL", suffix: " — Consigna de Equipaje", timezone: "America/Santiago",
    points: [
      { slug: "centro", name: "Plaza de Armas", district: "Santiago Centro", latitude: -33.43742, longitude: -70.65128 },
    ],
  },
  {
    key: "buenos-aires", city: "Buenos Aires", country: "AR", suffix: " — Consigna de Equipaje", timezone: "America/Argentina/Buenos_Aires",
    points: [
      { slug: "retiro", name: "Retiro", district: "Retiro", latitude: -34.59115, longitude: -58.37468 },
      { slug: "palermo", name: "Palermo", district: "Palermo", latitude: -34.58034, longitude: -58.42452 },
      { slug: "san-telmo", name: "San Telmo", district: "San Telmo", latitude: -34.6214, longitude: -58.37375 },
    ],
  },
  {
    key: "rio", city: "Rio de Janeiro", country: "BR", suffix: " — Depósito de Bagagem", timezone: "America/Sao_Paulo",
    points: [
      { slug: "copacabana", name: "Copacabana", district: "Copacabana", latitude: -22.9757, longitude: -43.18662 },
      { slug: "centro", name: "Centro", district: "Centro", latitude: -22.28, longitude: -42.53253 },
    ],
  },
  {
    key: "sao-paulo", city: "São Paulo", country: "BR", suffix: " — Depósito de Bagagem", timezone: "America/Sao_Paulo",
    points: [
      { slug: "paulista", name: "Avenida Paulista", district: "Bela Vista", latitude: -23.55609, longitude: -46.66227 },
    ],
  },
  {
    key: "montevideo", city: "Montevideo", country: "UY", suffix: " — Consigna de Equipaje", timezone: "America/Montevideo",
    points: [
      { slug: "ciudad-vieja", name: "Ciudad Vieja", district: "Ciudad Vieja", latitude: -34.90642, longitude: -56.20693 },
    ],
  },

  // ===== AFRİKA & OKYANUSYA =====
  {
    key: "cape-town", city: "Cape Town", country: "ZA", suffix: " Luggage Storage", timezone: "Africa/Johannesburg",
    points: [
      { slug: "waterfront", name: "V&A Waterfront", district: "Waterfront", latitude: -33.906, longitude: 18.41953 },
      { slug: "city-bowl", name: "City Bowl", district: "City Bowl", latitude: -33.92099, longitude: 18.42075 },
    ],
  },
  {
    key: "johannesburg", city: "Johannesburg", country: "ZA", suffix: " Luggage Storage", timezone: "Africa/Johannesburg",
    points: [
      { slug: "sandton", name: "Sandton", district: "Sandton", latitude: -26.10904, longitude: 28.05241 },
    ],
  },
  {
    key: "nairobi", city: "Nairobi", country: "KE", suffix: " Luggage Storage", timezone: "Africa/Nairobi",
    points: [
      { slug: "merkez", name: "Nairobi CBD", district: "CBD", latitude: -1.28273, longitude: 36.81835 },
    ],
  },
  {
    key: "zanzibar", city: "Zanzibar", country: "TZ", suffix: " Luggage Storage", timezone: "Africa/Dar_es_Salaam",
    points: [
      { slug: "stone-town", name: "Stone Town", district: "Stone Town", latitude: -6.16265, longitude: 39.18966 },
    ],
  },
  {
    key: "sidney", city: "Sydney", country: "AU", suffix: " Luggage Storage", timezone: "Australia/Sydney",
    points: [
      { slug: "circular-quay", name: "Circular Quay", district: "CBD", latitude: -33.86136, longitude: 151.21072 },
      { slug: "central-station", name: "Central Station", district: "Haymarket", latitude: -33.88399, longitude: 151.20634 },
      { slug: "bondi", name: "Bondi Beach", district: "Bondi", latitude: -33.8907, longitude: 151.27241 },
    ],
  },
  {
    key: "melbourne", city: "Melbourne", country: "AU", suffix: " Luggage Storage", timezone: "Australia/Melbourne",
    points: [
      { slug: "flinders-street", name: "Flinders Street Station", district: "CBD", latitude: -37.81842, longitude: 144.96648 },
      { slug: "st-kilda", name: "St Kilda", district: "St Kilda", latitude: -37.86811, longitude: 144.97422 },
    ],
  },
  {
    key: "brisbane", city: "Brisbane", country: "AU", suffix: " Luggage Storage", timezone: "Australia/Brisbane",
    points: [
      { slug: "merkez", name: "Queen Street Mall", district: "CBD", latitude: -27.46966, longitude: 153.02523 },
    ],
  },
  {
    key: "gold-coast", city: "Gold Coast", country: "AU", suffix: " Luggage Storage", timezone: "Australia/Brisbane",
    points: [
      { slug: "surfers-paradise", name: "Surfers Paradise", district: "Surfers Paradise", latitude: -28.00017, longitude: 153.42674 },
    ],
  },
  {
    key: "auckland", city: "Auckland", country: "NZ", suffix: " Luggage Storage", timezone: "Pacific/Auckland",
    points: [
      { slug: "merkez", name: "Queen Street", district: "CBD", latitude: -36.91344, longitude: 174.78413 },
    ],
  },
  {
    key: "queenstown", city: "Queenstown", country: "NZ", suffix: " Luggage Storage", timezone: "Pacific/Auckland",
    points: [
      { slug: "merkez", name: "Queenstown Mall", district: "Queenstown", latitude: -45.03222, longitude: 168.66099 },
    ],
  },
];

type Point = CityPoint & {
  key: string;
  city: string;
  suffix: string;
  country: string;
  verifyCc: string;
  timezone: string;
  fullSlug: string;
};

/** Düz liste — betiğin geri kalanı nokta bazında çalışıyor. */
const POINTS: Point[] = CITIES.flatMap((c) =>
  c.points.map((p) => ({
    ...p,
    key: c.key,
    city: c.city,
    suffix: c.suffix,
    country: c.country,
    verifyCc: c.verifyCc ?? c.country,
    timezone: c.timezone,
    fullSlug: `${c.key}-${p.slug}`,
  })),
);

/**
 * Liste elle düzenleniyor ve artık birkaç yüz satır; bu iki hatanın ikisi de
 * sessizce yanlış veri üretirdi, o yüzden her koşuda kontrol ediliyorlar:
 *
 * - Tekrar eden `fullSlug`: iki kayıt aynı işaretçiyi paylaşır, ikincisi
 *   birincinin üstüne yazar ve nokta kaybolur.
 * - Geçersiz IANA saat dilimi: slot üretimi bu alandan besleniyor.
 */
function assertListIsSane() {
  const seen = new Set<string>();
  const problems: string[] = [];

  for (const p of POINTS) {
    if (seen.has(p.fullSlug)) problems.push(`tekrar eden slug: ${p.fullSlug}`);
    seen.add(p.fullSlug);

    if (!Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90) {
      problems.push(`gecersiz enlem: ${p.fullSlug} (${p.latitude})`);
    }
    if (!Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180) {
      problems.push(`gecersiz boylam: ${p.fullSlug} (${p.longitude})`);
    }
  }

  for (const c of CITIES) {
    try {
      Intl.DateTimeFormat("en-US", { timeZone: c.timezone });
    } catch {
      problems.push(`gecersiz saat dilimi: ${c.key} (${c.timezone})`);
    }
  }

  if (problems.length > 0) {
    console.error("LISTE HATALI:\n  " + problems.join("\n  "));
    process.exit(1);
  }
}

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
    list: argv.includes("--list"),
    verify: argv.includes("--verify"),
    city: argv.includes("--city") ? argv[argv.indexOf("--city") + 1] : null,
    close: argv.includes("--close") ? argv[argv.indexOf("--close") + 1] : null,
  };
}

function selectPoints(city: string | null): Point[] {
  if (!city) return POINTS;
  const selected = POINTS.filter((p) => p.key === city);
  if (selected.length === 0) {
    const keys = CITIES.map((c) => c.key).join(", ");
    console.error(`Bilinmeyen sehir: ${city}\nGecerli anahtarlar: ${keys}`);
    process.exit(1);
  }
  return selected;
}

/**
 * Koordinat denetimi: her noktayı ters geocode edip dönen ülke kodunu
 * `country` ile karşılaştırır.
 *
 * NEDEN TERS, ileri değil: değerleri ileri geocode üretti, aynı sorguyu
 * tekrarlamak kendi kendini onaylamaktan başka bir şey olmazdı. Ters yön
 * bağımsız bir kanıt — koordinatın gerçekte NEREYE düştüğünü söylüyor.
 *
 * Nominatim kullanım politikası saniyede bir istek; betik ona uyar, o yüzden
 * tüm liste için birkaç dakika sürer. `--city` ile daraltılabilir.
 */
async function verifyCoordinates(points: Point[]) {
  const mismatches: string[] = [];

  for (const [i, p] of points.entries()) {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(p.latitude));
    url.searchParams.set("lon", String(p.longitude));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "10");

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "bagajpark-prelaunch-points/1.0 (support@bagajpark.com)",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        address?: { country_code?: string };
      };
      const cc = (data.address?.country_code ?? "").toUpperCase();
      if (cc !== p.verifyCc) {
        mismatches.push(`${p.fullSlug}: beklenen ${p.verifyCc}, bulunan ${cc || "-"}`);
      }
    } catch (e) {
      mismatches.push(`${p.fullSlug}: sorgulanamadi (${(e as Error).message})`);
    }

    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${points.length}`);
    await new Promise((r) => setTimeout(r, 1100));
  }

  if (mismatches.length === 0) {
    console.log(`${points.length} noktanin hepsi dogru ulkede.`);
    return;
  }
  console.error(`\n${mismatches.length} nokta eslesmedi:\n  ` + mismatches.join("\n  "));
  process.exit(1);
}

async function main() {
  const args = parseArgs();
  assertListIsSane();

  if (args.close) {
    const prisma = await getPrisma();
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

  const selected = selectPoints(args.city);
  const cityCount = new Set(selected.map((p) => p.key)).size;

  if (args.list) {
    for (const c of CITIES) {
      if (args.city && c.key !== args.city) continue;
      console.log(`${c.key.padEnd(20)} ${c.city} (${c.country})  ${c.points.length} nokta`);
    }
    console.log(`\nToplam ${selected.length} nokta / ${cityCount} sehir`);
    return;
  }

  if (args.verify) {
    console.log(`${selected.length} nokta ters geocode ediliyor (~1 istek/sn)...`);
    await verifyCoordinates(selected);
    return;
  }

  console.log(
    `${selected.length} nokta, ${cityCount} sehir` +
      (args.apply ? "" : "  [KURU CALISMA -- hicbir sey yazilmaz]"),
  );

  const prisma = await getPrisma();
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
    const marker = `[prelaunch:${p.fullSlug}]`;
    const existing = await prisma.shop.findFirst({
      where: { description: { contains: marker } },
      select: { id: true },
    });

    const data = {
      name: `${p.name}${p.suffix}`,
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
      console.log(`  guncelle  ${p.fullSlug.padEnd(32)} ${data.name}`);
      if (args.apply) {
        await prisma.shop.update({ where: { id: existing.id }, data });
      }
    } else {
      created++;
      console.log(`  OLUSTUR   ${p.fullSlug.padEnd(32)} ${data.name}`);
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
  .finally(async () => {
    // Yalnızca gerçekten açıldıysa kapat: `--list`/`--verify` hiç açmadı.
    if (!prismaOpened) return;
    await (await import("../src/lib/db")).default.$disconnect();
  });

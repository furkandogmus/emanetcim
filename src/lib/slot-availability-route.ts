import { NextRequest, NextResponse } from "next/server";
import { getSlotAvailability } from "@/services/SlotService";

/**
 * Dükkan slot müsaitliği uç GÖVDESİ — web ve mobil aynı yanıtı verir.
 *
 * NEDEN ORTAK (2026-08-25'te ölçüldü): `api/shops/[id]/slots` ve
 * `api/mobile/shops/[id]/slots` aynı 25 satırı taşıyordu — aynı sorgu ayrıştırma,
 * aynı doğrulama, aynı önbellek başlığı. Ayrıca mobil kopyada ÖLÜ bir yetki
 * bloğu vardı:
 *
 *     try { await requireMobileUser(req); } catch { return 401; }
 *
 * `requireMobileUser` HİÇ FIRLATMAZ, başarısızlıkta `{ error: NextResponse }`
 * DÖNDÜRÜR (`src/lib/mobile-auth.ts`). Yani `catch` hiçbir zaman çalışmıyordu ve
 * uç fiilen kimlik doğrulaması YAPMIYORDU — kod okuyana yanlış güvence veriyordu.
 *
 * Slot müsaitliği zaten HERKESE AÇIK veridir: web ucu de kimlik istemiyor, misafir
 * rezervasyon akışı giriş yapmadan slot görmek zorunda. Bu yüzden doğru düzeltme
 * yetkiyi gerçekten uygulamak değil, ölü kodu kaldırıp açıklığı SÖYLEMEKTİR.
 */

/** İstemci saatlik yenilenmeyi beklemiyor; 30 sn hem tazelik hem yük dengesi. */
const CACHE_HEADER = { "Cache-Control": "public, max-age=30, s-maxage=30" };

/**
 * İSTENEBİLECEK EN GENİŞ ARALIK.
 *
 * NEDEN VAR (2026-08-31'de ölçüldü): `from` ve `to` doğrudan
 * `getSlotAvailability`'ye geçiyordu ve orada `findMany` **`take` almıyor**.
 * Yani `?from=1970-01-01&to=2100-01-01` göndermek, o dükkanın bütün slot
 * satırlarını çekip kimliklerini bir `groupBy`'ın `IN` listesine koyuyor ve
 * hepsini JSON'a seriliyordu — **kimlik doğrulaması olmayan** bir uçta.
 *
 * Bugünkü hacimde bunun bedeli sınırlı (slot üretimi sınırlı bir ufuk için
 * çalışıyor), ama bedel VERİ BÜYÜDÜKÇE büyüyor ve istekle değil tabloyla
 * sınırlı olması bir tasarım değil, tesadüf.
 *
 * Sınır cömert: arayüz **tek günlük** pencere istiyor
 * (`SlotAvailabilityGrid` → `dayWindow`), en uzun konaklama ise 30 gün
 * (`pricing-rules`). 31 gün ikisini de rahatça karşılıyor.
 */
const MAX_RANGE_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function handleSlotAvailability(
  req: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  const { id: shopId } = await params;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to query params" }, { status: 400 });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  /*
    Sıra ve genişlik doğrulaması. `to <= from` de kontrol edilmiyordu: ters
    aralık boş sonuç döndürüyordu, yani istemci "müsait slot yok" ile "yanlış
    parametre gönderdim" durumlarını birbirinden ayıramıyordu.
  */
  const spanMs = toDate.getTime() - fromDate.getTime();
  if (spanMs <= 0) {
    return NextResponse.json(
      { error: "`to` must be after `from`" },
      { status: 400 },
    );
  }
  if (spanMs > MAX_RANGE_DAYS * DAY_MS) {
    return NextResponse.json(
      { error: `Range too wide (max ${MAX_RANGE_DAYS} days)` },
      { status: 400 },
    );
  }

  const slots = await getSlotAvailability(shopId, fromDate, toDate);
  return NextResponse.json({ slots }, { headers: CACHE_HEADER });
}

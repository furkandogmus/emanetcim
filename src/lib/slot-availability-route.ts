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

  const slots = await getSlotAvailability(shopId, fromDate, toDate);
  return NextResponse.json({ slots }, { headers: CACHE_HEADER });
}

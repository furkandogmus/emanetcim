import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, isRateLimited } from "@/lib/internal-api-guard";
import { withJobRun } from "@/lib/jobs/run-ledger";
import { shopService } from "@/services/ShopService";

/**
 * POST /api/internal/response-times — dükkanların "yanıt süresi" rozetini
 * gerçek onay verisinden yeniden hesaplar.
 *
 * NEDEN İŞ OLARAK (P2-7): `Shop.responseTimeMinutes` kolonunu yazan hiçbir kod
 * yolu yoktu; platform genelinde 0'dı ve rozet karşılıksız bir güven iddiasıydı.
 * Hesap istekten (`Booking.createdAt`) onaya (`BookingEvent` `APPROVED`) geçen
 * süredir; kaynağı sayfa isteği değil geçmiş olduğu için zamanlanmış iş.
 *
 * İDEMPOTENT: yalnızca okur ve `responseTimeMinutes`'ı yazar; olay üretmez,
 * bildirim göndermez. Tekrar çalıştırmak aynı sonucu verir.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authState = authorizeCron(req);
  if (authState === "not_configured") {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (authState === "unauthorized") {
    if (await isRateLimited(req, "response-times", 10, 60_000)) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const outcome = await withJobRun("response-times", async () => {
    const result = await shopService.recomputeResponseTimes();
    return { ok: true as const, detail: result };
  });

  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...outcome.detail });
}

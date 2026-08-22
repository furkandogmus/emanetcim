import { NextRequest, NextResponse } from "next/server";
import { authorizeCron, isRateLimited } from "@/lib/internal-api-guard";
import { overdueBookingService } from "@/services/OverdueBookingService";
import logger from "@/lib/logger";

/**
 * POST /api/internal/overdue-scan — süre aşımı mutabakatı.
 *
 * Çıkış saati geçtiği hâlde hâlâ açık rezervasyonları bulur, eşik atlayanlara
 * `BookingEvent` (`OVERDUE`) yazar ve rapor döner. **Durum değiştirmez** —
 * gerekçe `OverdueBookingService` başında.
 *
 * NEDEN VAR: prod'da 19 rezervasyonun 18'i çıkış saatini geçmiş hâlde açıktı ve
 * hiçbiri hiç `CHECKED_OUT` olmamıştı; üç müşterinin bavulu Haziran'dan beri
 * "dükkanda" görünüyordu. Bunu kimse fark etmemişti çünkü hiç tarama yoktu
 * (2026-08-22 denetimi, P1-6).
 *
 * GET yerine POST: olay yazan bir işlem GET olmamalı, aksi halde bir tarayıcı
 * ön-getirmesi ya da link taraması bile tetikleyebilir. Salt okunur özeti
 * `GET /api/health/jobs` verir ve sır gerektirmez.
 *
 * Günde bir kez çalıştırılması önerilir.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authState = authorizeCron(req);
  if (authState === "not_configured") {
    logger.warn({}, "overdue_scan_disabled_no_cron_secret");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (authState === "unauthorized") {
    if (await isRateLimited(req, "overdue-scan", 10, 60_000)) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await overdueBookingService.scan();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    logger.error({ err }, "overdue_scan_failed");
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

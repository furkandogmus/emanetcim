import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fillMissingSlots } from "@/services/SlotService";
import { authorizeCron, isRateLimited } from "@/lib/internal-api-guard";
import logger from "@/lib/logger";

/**
 * POST /api/internal/generate-slots — aktif dükkanlar için ileri tarihli zaman
 * slotlarını üretir. Zamanlanmış iş tarafından çağrılır.
 *
 * Koruma: `CRON_SECRET` (Bearer veya `X-Cron-Secret`). Bu uç eskiden TAMAMEN
 * korumasizdi ve isimsiz herhangi biri her cagrida binlerce satirlik upsert
 * tetikleyebiliyordu (son tam calisma 3.696 satir uretti) — 2026-08-22 denetimi.
 *
 * GET yerine POST: yazma yapan bir islem GET olmamali, aksi halde bir tarayici
 * on-getirmesi ya da link taramasi bile tetikleyebilir.
 */
async function run(req: NextRequest): Promise<NextResponse> {
  const authState = authorizeCron(req);
  if (authState === "not_configured") {
    logger.warn({}, "generate_slots_disabled_no_cron_secret");
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (authState === "unauthorized") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Dogru sirri bilen biri bile bunu dakikada bir cagirmamali.
  if (await isRateLimited(req, "generate_slots", 4, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  try {
    const started = Date.now();
    const count = await fillMissingSlots();
    logger.info(
      { slotsGenerated: count, durationMs: Date.now() - started },
      "generate_slots_completed",
    );
    return NextResponse.json({ ok: true, slotsGenerated: count });
  } catch (error) {
    // Sessizce yutmuyoruz: slot uretimi durursa saatlik urun secilemez hale
    // gelir ve bu 2026-07-14'ten 2026-08-22'ye kadar 37 gun fark edilmedi.
    logger.error({ err: error }, "generate_slots_failed");
    return NextResponse.json(
      { ok: false, error: "generate_slots_failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return run(req);
}

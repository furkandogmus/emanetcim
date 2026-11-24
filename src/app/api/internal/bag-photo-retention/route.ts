import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/internal-api-guard";
import { withJobRun } from "@/lib/jobs/run-ledger";
import logger from "@/lib/logger";
import { bagPhotoService } from "@/services/BagPhotoService";

/** Valiz fotografi saklama kurali: `src/lib/bag-photos.ts` -> `bagPhotoDeleteAt`. */
export async function POST(req: NextRequest) {
  const denial = authorizeCron(req);
  if (denial === "not_configured") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (denial) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const outcome = await withJobRun("bag-photo-retention", async () => {
    const detail = await bagPhotoService.runRetention(new Date());
    // Silinemeyen nesne satiri birakir ve yarin yeniden denenir; is yine basarili sayilir.
    return { ok: true as const, detail };
  });
  if (!outcome.ok) {
    logger.error({ error: outcome.error }, "bag_photo_retention_failed");
    return NextResponse.json({ ok: false, error: outcome.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...outcome.detail });
}

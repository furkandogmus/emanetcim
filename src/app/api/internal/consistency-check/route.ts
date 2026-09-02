import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/internal-api-guard";
import { withJobRun } from "@/lib/jobs/run-ledger";
import logger from "@/lib/logger";
import { consistencyService } from "@/services/ConsistencyService";

/**
 * İki kaydın sessizce ayrışmasını arar — OKUR, DÜZELTMEZ.
 *
 * Gerekçenin tamamı `ConsistencyService`te. Özeti: bu kod tabanındaki
 * hataların büyük bölümü "aynı gerçeği tutan iki kayıttan biri güncellendi,
 * diğeri geride kaldı" biçiminde çıktı. Kodda düzeltildiler, ama düzeltmeler
 * yalnızca bundan sonrasını korur; hata sürerken üretilmiş kayıtlar
 * veritabanında durur ve hiçbir ekran onları göstermez.
 */
export async function GET(req: NextRequest) {
  const denial = authorizeCron(req);
  if (denial === "not_configured") {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (denial) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const outcome = await withJobRun("consistency-check", async () => {
    const report = await consistencyService.scan();

    /*
      TEMİZ SONUÇ DA LOGLANIR. "Hiçbir şey yazmayan iş" ile "çalışmayan iş"
      birbirinden ayırt edilemez; bu ayrım bu depoda daha önce sekiz işten
      dördünü sessizce ölü bırakmıştı.
    */
    if (report.clean) {
      logger.info({}, "consistency_check_clean");
    } else {
      for (const f of report.findings) {
        logger.warn(
          { kind: f.kind, count: f.count, samples: f.samples },
          "consistency_check_finding",
        );
      }
    }
    return { ok: true as const, detail: report };
  });

  if (!outcome.ok) {
    logger.error({ error: outcome.error }, "consistency_check_failed");
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...outcome.detail });
}

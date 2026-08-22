import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { authorizeCron, isRateLimited } from "@/lib/internal-api-guard";
import { withJobRun } from "@/lib/jobs/run-ledger";
import { classifyInboxMessage } from "@/lib/inbox-classifier";

/**
 * POST /api/internal/classify-inbox — sınıflandırılmamış gelen kutusu mesajlarını
 * sınıflandırır.
 *
 * NEDEN İŞ OLARAK: sınıflandırma kuralı başlıklara bakıyor (`List-Unsubscribe`,
 * `Auto-Submitted`) ve o başlıklar `raw` JSON'unun içinde. Migrasyonda SQL ile
 * yeniden uygulamak, kuralın **ikinci bir kopyası** olurdu ve iki kopya ayrışırdı.
 * Bu iş aynı kodu kullanır (P1-18).
 *
 * İDEMPOTENT: yalnızca `UNCLASSIFIED` satırlara dokunur. Tekrar çalıştırmak
 * zararsızdır ve ikinci çalıştırmada `classified: 0` döner.
 */
export const dynamic = "force-dynamic";

/** Tek çalıştırmada işlenecek azami satır. Büyük kutuda birden çok tur gerekir. */
const BATCH_SIZE = 500;

export async function POST(req: NextRequest) {
  const authState = authorizeCron(req);
  if (authState === "not_configured") {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (authState === "unauthorized") {
    if (await isRateLimited(req, "classify-inbox", 10, 60_000)) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const outcome = await withJobRun("classify-inbox", async () => {
    const pending = await prisma.contactMessage.findMany({
      where: { category: "UNCLASSIFIED" },
      select: { id: true, from: true, subject: true, raw: true },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });

    const byCategory: Record<string, number> = {};
    let classified = 0;

    for (const msg of pending) {
      const result = classifyInboxMessage({
        from: msg.from,
        subject: msg.subject,
        raw: msg.raw,
      });
      try {
        await prisma.contactMessage.update({
          where: { id: msg.id },
          data: { category: result.category, categoryReason: result.reason },
        });
        byCategory[result.category] = (byCategory[result.category] ?? 0) + 1;
        classified += 1;
      } catch (err) {
        logger.error({ err, messageId: msg.id }, "classify_inbox_update_failed");
      }
    }

    const remaining = await prisma.contactMessage.count({
      where: { category: "UNCLASSIFIED" },
    });

    return {
      ok: true as const,
      detail: {
        classified,
        byCategory,
        // Sessiz kırpma yok: partiye sığmayan varsa açıkça söylenir.
        remaining,
        moreToDo: remaining > 0,
      },
    };
  });

  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...outcome.detail });
}

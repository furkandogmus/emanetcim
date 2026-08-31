import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/internal-api-guard";
import prisma from "@/lib/db";
import { withJobRun } from "@/lib/jobs/run-ledger";
import { moneyToNumber } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Finans özeti CSV — cron veya operasyon (`CRON_SECRET`).
 * Query: `days` (varsayılan 90).
 */
export async function GET(req: NextRequest) {
  /*
    ORTAK KAPIYA GECILDI (2026-08-31). Bu dosya `CRON_SECRET` karsilastirmasini
    kendi icinde yaziyordu ve `bearer === secret` kullaniyordu -- yani sabit
    ZAMANLI olmayan bir karsilastirma. `authorizeCron` ayni isi
    `crypto.timingSafeEqual` ile yapiyor ve zaten UC ucta kullaniliyordu; bu dosya
    (ve iki kardesi) kopyada kalmisti. Kopya olmasi, `internal-api-guard.ts`in var
    olma gerekcesinin tam olarak gerceklestigi yer: bir uc duzeltilirken digerleri
    unutuluyor.
  */
  const denial = authorizeCron(req);
  if (denial === "not_configured") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (denial) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(
    365 * 3,
    Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 90),
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Defter kaydi: is CSV dondurse bile CALISTIGI kayda gecmeli. Yoksa
  // /api/health/jobs bu isi HIC gormez ve enforced=true yapildiginda sonsuza
  // dek "gecikmis" gorunur -- 2026-08-29'da sekiz isten DORDU boyleydi:
  // HTTP 200 donuyorlardi ama JobRun'a tek satir yazmiyorlardi.
  const outcome = await withJobRun("finance-export", async () => {
    const found = await prisma.booking.findMany({
      where: { createdAt: { gte: since } },
      include: {
        paymentLog: true,
        shop: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    return { ok: true as const, detail: found };
  });
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.error }, { status: 500 });
  }
  const rows = outcome.detail;

  const header = [
    "bookingId",
    "createdAt",
    "status",
    "shopName",
    "totalTry",
    "paymentStatus",
    "transactionId",
    "chargebackStatus",
  ].join(",");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lines = (rows as any[]).map((b) => {
    const pl = b.paymentLog;
    return [
      b.id,
      b.createdAt.toISOString(),
      b.status,
      `"${(b.shop?.name ?? "").replace(/"/g, '""')}"`,
      moneyToNumber(b.totalPrice),
      pl?.status ?? "",
      pl?.transactionId ?? "",
      pl?.chargebackStatus ?? "",
    ].join(",");
  });

  const csv = [header, ...lines].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finance-export-${since.toISOString().slice(0, 10)}.csv"`,
    },
  });
}

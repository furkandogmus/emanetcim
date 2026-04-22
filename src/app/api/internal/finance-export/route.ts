import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { moneyToNumber } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assertCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = req.headers.get("x-cron-secret")?.trim() ?? "";
  return bearer === secret || header === secret;
}

/**
 * Finans özeti CSV — cron veya operasyon (`CRON_SECRET`).
 * Query: `days` (varsayılan 90).
 */
export async function GET(req: NextRequest) {
  if (!assertCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(
    365 * 3,
    Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 90),
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.booking.findMany({
    where: { createdAt: { gte: since } },
    include: {
      paymentLogs: true,
      shop: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

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

  const lines = rows.map((b) => {
    const pl = b.paymentLogs;
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

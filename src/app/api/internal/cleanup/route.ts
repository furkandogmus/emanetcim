import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import logger from "@/lib/logger";

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const headerSecret = req.headers.get("x-cron-secret");
  return bearer === secret || headerSecret === secret;
}

/**
 * Veritabanı Hijyeni: Süresi geçmiş token ve oturumları temizleme.
 * Günde bir kez çalıştırılması önerilir.
 */
async function runCleanup(req: NextRequest): Promise<NextResponse> {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const [deletedTokens, deletedSessions] = await prisma.$transaction([
      prisma.verificationToken.deleteMany({
        where: { expires: { lt: now } },
      }),
      prisma.session.deleteMany({
        where: { expires: { lt: now } },
      }),
    ]);

    logger.info(
      { deletedTokens: deletedTokens.count, deletedSessions: deletedSessions.count },
      "database_cleanup_success"
    );

    return NextResponse.json({
      ok: true,
      deletedTokens: deletedTokens.count,
      deletedSessions: deletedSessions.count,
    });
  } catch (err) {
    logger.error({ err }, "database_cleanup_failed");
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return runCleanup(req);
}

export async function POST(req: NextRequest) {
  return runCleanup(req);
}

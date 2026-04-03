import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Readiness: Postgres `SELECT 1` — load balancer / uptime “dependency check”.
 * Safsız liveness için `/api/health/live` kullanın.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "UP",
        checks: { database: "ok" },
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error({ err: error }, "health_ready_failed");
    return NextResponse.json(
      {
        status: "DOWN",
        checks: { database: "error" },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

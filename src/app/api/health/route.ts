import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { getRedis } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Readiness: Postgres `SELECT 1` — load balancer / uptime “dependency check”.
 * Safsız liveness için `/api/health/live` kullanın.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    let redis: "ok" | "error" | "not_configured" = "not_configured";
    const redisClient = getRedis();
    if (redisClient) {
      try {
        const pong = await redisClient.ping();
        redis = pong === "PONG" ? "ok" : "error";
      } catch {
        redis = "error";
      }
    }

    const rateLimitMode =
      process.env.NODE_ENV === "production" && !redisClient
        ? "in_memory_fallback"
        : redisClient
          ? "redis"
          : "in_memory_dev";

    return NextResponse.json(
      {
        status: "UP",
        checks: {
          database: "ok",
          redis,
          rateLimitMode,
          distributedRateLimitRequired:
            process.env.REQUIRE_DISTRIBUTED_RATE_LIMIT === "true",
        },
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

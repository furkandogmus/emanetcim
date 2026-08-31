import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { getRedis } from "@/lib/rate-limit";
import { getShopDistanceBackend } from "@/lib/shop-distance-postgis";

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

    /*
      PostGIS PROBU (2026-08-31'de eklendi).

      Arama, mesafe siralamasini PostGIS ile yapiyor; eklenti yoksa ya da sorgu
      hata verirse SESSIZCE butun aktif dukkanlari bellege alip siralayan yedek
      yola dusuyordu. Sonuclar dogru cikiyor, yani disaridan hicbir sey yanlis
      gorunmuyor -- ama sitenin en cok trafik alan sayfasi her istekte tam tablo
      tariyor. `docker-compose.yml` `postgis/postgis` imajini kullaniyor ama
      eklentiyi kuran bir migration YOK: eklenti imajin acilis betigine bagli,
      yani eski bir veri biriminden gecilmisse kurulu olmayabilir.

      Burada `SELECT postgis_version()` ile DOGRUDAN soruluyor; ayrica
      `distanceBackend` en son hangi yolun kullanildigini soyluyor (surec
      basladiktan sonra hic arama yapilmadiysa `unknown`).
    */
    let postgis: "ok" | "missing" = "missing";
    try {
      await prisma.$queryRaw`SELECT postgis_version()`;
      postgis = "ok";
    } catch {
      postgis = "missing";
    }

    return NextResponse.json(
      {
        status: "UP",
        checks: {
          database: "ok",
          redis,
          rateLimitMode,
          postgis,
          distanceBackend: getShopDistanceBackend(),
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

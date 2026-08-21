import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Zamanlanmış işlerin GERÇEKTEN çalıştığını ölçen sağlık kontrolü.
 *
 * NEDEN AYRI BİR UÇ: `/api/health` veritabanı ve Redis'e bakıyor. Slot üretimi
 * 2026-07-14'te durup 37 gün fark edilmediğinde ikisi de sapasağlamdı — yani o
 * kesintiyi yakalayamazdı. Altyapı sağlığı ile iş sağlığı ayrı şeyler.
 *
 * TAZELİK NASIL ÖLÇÜLÜYOR (migration gerektirmeden): slot üretimi her çalıştığında
 * bugünden 30 gün ileriye slot yazar. Çalışmadığı her gün bu ufuk 1 gün kısalır.
 * Yani `ufuk = 30 - son_calismadan_beri_gecen_gun`. Ufkun kendisi, ayrı bir
 * "son çalışma" kaydı tutmadan tazeliğin ölçüsüdür.
 *
 * SONUÇ KODU: sağlıksızsa 503. Böylece herhangi bir aptal HTTP izleyici
 * (UptimeRobot, Cloudflare health check, telefondan curl) sır bilmeden alarm
 * verebilir — bu ucun herkese açık olmasının sebebi de bu.
 */

/** Üretim 30 gün ileriye yazar; 28'in altı = iş ~2 gündür çalışmıyor. */
const SLOT_HORIZON_MIN_DAYS = 28;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const now = new Date();

    const [newestSlot, activeShopCount, futureSlotCount] = await Promise.all([
      prisma.shopTimeSlot.aggregate({ _max: { startTime: true } }),
      prisma.shop.count({
        where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
      }),
      prisma.shopTimeSlot.count({ where: { startTime: { gt: now } } }),
    ]);

    const newest = newestSlot._max.startTime;
    const horizonDays = newest
      ? Math.floor((newest.getTime() - now.getTime()) / MS_PER_DAY)
      : 0;

    // Hiç aktif dükkan yoksa slot beklentisi de yoktur — kontrol uygulanamaz.
    // Aksi halde dükkanı olmayan bir ortam sonsuza kadar kırmızı yanar.
    const applicable = activeShopCount > 0;

    const slotGeneration = {
      status: !applicable
        ? ("not_applicable" as const)
        : horizonDays >= SLOT_HORIZON_MIN_DAYS
          ? ("ok" as const)
          : ("stale" as const),
      horizonDays,
      minExpectedDays: SLOT_HORIZON_MIN_DAYS,
      newestSlotAt: newest ? newest.toISOString() : null,
      futureSlotCount,
      /** Ufuk 30'dan ne kadar kısaldıysa, iş o kadar gündür çalışmamış demektir. */
      estimatedDaysSinceLastRun: applicable ? Math.max(0, 30 - horizonDays) : null,
    };

    const healthy = slotGeneration.status !== "stale";

    if (!healthy) {
      logger.warn(
        { horizonDays, futureSlotCount, activeShopCount },
        "health_jobs_slot_generation_stale",
      );
    }

    return NextResponse.json(
      {
        status: healthy ? "UP" : "DEGRADED",
        checks: { slotGeneration },
        context: { activeShopCount },
        timestamp: now.toISOString(),
      },
      { status: healthy ? 200 : 503 },
    );
  } catch (error) {
    logger.error({ err: error }, "health_jobs_failed");
    return NextResponse.json(
      {
        status: "DOWN",
        checks: { slotGeneration: { status: "unknown" } },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

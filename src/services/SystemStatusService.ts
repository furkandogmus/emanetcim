import prisma from "@/lib/db";
import nextPackage from "next/package.json";
import { isNetgsmConfigured } from "@/lib/netgsm";
import { SERVER_VERSION } from "@/lib/server-version";

export type SystemCheck = "ok" | "missing" | "error";
export type SystemHealthLevel = "ok" | "warning" | "error";

export type SystemStatusSnapshot = {
  checkedAt: string;
  serverVersion: string;
  checks: {
    database: SystemCheck;
    email: SystemCheck;
    sms: SystemCheck;
    authSecret: SystemCheck;
  };
  /** Gonderen adresi gizli degil; web karti da gosteriyor. */
  emailFrom: string | null;
  runtime: {
    node: string;
    next: string;
    platform: string;
    production: boolean;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  healthScore: number;
  healthLevel: SystemHealthLevel;
};

/** Agirliklar web `/admin/status` ile ayni kaldi; esik 90 / 60. */
const WEIGHTS = { database: 35, authSecret: 25, email: 20, sms: 20 } as const;

export function healthLevelFor(score: number): SystemHealthLevel {
  if (score >= 90) return "ok";
  if (score >= 60) return "warning";
  return "error";
}

/**
 * Yonetici sistem durumu: DB, e-posta, SMS ve surum. Web `/admin/status` ve mobil
 * `admin/system` ayni anlik goruntuyu okur; skor kurali tek yerde.
 *
 * Yalniz "yapilandirilmis mi" sorusunu cevaplar; zamanlanmis islerin calisip
 * calismadigini `JobHealthService` soyler (slot uretimi 37 gun durdugunda bu skor
 * yesildi).
 */
export class SystemStatusService {
  async snapshot(now: Date = new Date()): Promise<SystemStatusSnapshot> {
    const dbReachable = await prisma.$queryRaw`SELECT 1`.then(
      () => true,
      () => false,
    );
    const checks: SystemStatusSnapshot["checks"] = {
      database: !process.env.DATABASE_URL ? "missing" : dbReachable ? "ok" : "error",
      email: process.env.RESEND_API_KEY ? "ok" : "missing",
      // SMS gonderimiyle AYNI kontrol (`NETGSM_USERNAME`/`NETGSM_PASSWORD`).
      sms: isNetgsmConfigured() ? "ok" : "missing",
      authSecret: process.env.AUTH_SECRET ? "ok" : "missing",
    };
    const healthScore = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce(
      (sum, k) => sum + (checks[k] === "ok" ? WEIGHTS[k] : 0),
      0,
    );
    const mem = process.memoryUsage();
    return {
      checkedAt: now.toISOString(),
      serverVersion: SERVER_VERSION,
      checks,
      emailFrom: process.env.RESEND_FROM?.trim() || null,
      runtime: {
        node: process.version,
        next: nextPackage.version,
        platform: process.platform,
        production: process.env.NODE_ENV === "production",
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      },
      healthScore,
      healthLevel: healthLevelFor(healthScore),
    };
  }
}

export const systemStatusService = new SystemStatusService();

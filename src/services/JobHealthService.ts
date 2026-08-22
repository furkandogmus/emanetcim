import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { JOB_REGISTRY, type JobDefinition } from "@/lib/jobs/registry";

/**
 * Zamanlanmış işlerin sağlığı — kayıt defterine göre.
 *
 * NEDEN DEFTERDEN: slot üretiminin tazeliği daha önce slot ufkundan çıkarılıyordu
 * (üretim 30 gün ileriye yazar, her çalışmadığı gün ufuk 1 kısalır). Zekice ama
 * DOLAYLI bir ölçüydü ve yalnızca o iş için çalışıyordu; diğer beş iş hiç
 * ölçülmüyordu. `JobRun` defteri ölçüyü genelleştirir (P1-11).
 *
 * Dolaylı ölçü kaldırılmadı, tamamlayıcı olarak duruyor: defter işin ÇALIŞTIĞINI
 * söyler, slot ufku işin İŞE YARADIĞINI söyler. İkisi farklı sorulardır — iş her
 * gece başarıyla çalışıp hiç slot üretmiyor olabilir.
 */

export type JobStatusRow = {
  job: string;
  what: string;
  cron: string;
  /** Cron kurulu ve gecikmesi alarm üretmeli mi? */
  enforced: boolean;
  lastSuccessAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  hoursSinceSuccess: number | null;
  maxStaleHours: number;
  /** `ok` | `stale` | `never_run` */
  status: "ok" | "stale" | "never_run";
};

export type JobHealthReport = {
  checkedAt: string;
  jobs: JobStatusRow[];
  /** Alarm üretmesi gereken (enforced) ve gecikmiş iş sayısı. */
  enforcedStale: number;
  /** Hiç çalışmamış iş sayısı — enforced olmayanlar dahil, bilgi amaçlı. */
  neverRun: number;
  status: "ok" | "stale";
};

const MS_PER_HOUR = 60 * 60 * 1000;

export class JobHealthService {
  async check(now: Date = new Date()): Promise<JobHealthReport> {
    const names = JOB_REGISTRY.map((j) => j.name);

    // Tek sorguda her iş için son başarılı ve son herhangi çalıştırma.
    const [lastSuccesses, lastRuns] = await Promise.all([
      prisma.jobRun.groupBy({
        by: ["job"],
        where: { job: { in: [...names] }, status: "SUCCESS" },
        _max: { finishedAt: true },
      }),
      prisma.jobRun.groupBy({
        by: ["job"],
        where: { job: { in: [...names] } },
        _max: { startedAt: true },
      }),
    ]);

    const successAt = new Map<string, Date | null>();
    for (const r of lastSuccesses) successAt.set(r.job, r._max.finishedAt);
    const runAt = new Map<string, Date | null>();
    for (const r of lastRuns) runAt.set(r.job, r._max.startedAt);

    // Son çalıştırmanın durumu, yalnızca hiç çalışmış işler için.
    const ranJobs = [...runAt.keys()];
    const latestStatuses = ranJobs.length
      ? await prisma.jobRun.findMany({
          where: { job: { in: ranJobs } },
          orderBy: { startedAt: "desc" },
          distinct: ["job"],
          select: { job: true, status: true },
        })
      : [];
    const lastStatus = new Map(latestStatuses.map((r) => [r.job, r.status]));

    const rows: JobStatusRow[] = JOB_REGISTRY.map((def: JobDefinition) => {
      const success = successAt.get(def.name) ?? null;
      const run = runAt.get(def.name) ?? null;
      const hours = success
        ? Math.floor((now.getTime() - success.getTime()) / MS_PER_HOUR)
        : null;

      let status: JobStatusRow["status"];
      if (!success) {
        status = "never_run";
      } else if (hours !== null && hours >= def.maxStaleHours) {
        status = "stale";
      } else {
        status = "ok";
      }

      return {
        job: def.name,
        what: def.what,
        cron: def.cron,
        enforced: def.enforced,
        lastSuccessAt: success ? success.toISOString() : null,
        lastRunAt: run ? run.toISOString() : null,
        lastRunStatus: lastStatus.get(def.name) ?? null,
        hoursSinceSuccess: hours,
        maxStaleHours: def.maxStaleHours,
        status,
      };
    });

    /**
     * Yalnızca `enforced` işler DEGRADED üretir.
     *
     * Henüz cron'u kurulmamış bir iş "bozuk" değil, "beklemede"dir. Onları da
     * kırmızı saymak kalıcı kırmızı bir sağlık kontrolü demektir — ve kalıcı
     * kırmızı, kimsenin bakmadığı kontroldür. Kayıt defterindeki `enforced`
     * bayrağı cron kurulunca `true` yapılır.
     */
    const enforcedStale = rows.filter(
      (r) => r.enforced && r.status !== "ok",
    ).length;
    const neverRun = rows.filter((r) => r.status === "never_run").length;

    const report: JobHealthReport = {
      checkedAt: now.toISOString(),
      jobs: rows,
      enforcedStale,
      neverRun,
      status: enforcedStale > 0 ? "stale" : "ok",
    };

    if (report.status === "stale") {
      logger.warn(
        {
          stale: rows.filter((r) => r.enforced && r.status !== "ok").map((r) => r.job),
        },
        "job_health_stale",
      );
    }

    return report;
  }
}

export const jobHealthService = new JobHealthService();

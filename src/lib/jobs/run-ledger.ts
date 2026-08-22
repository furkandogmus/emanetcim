import prisma from "@/lib/db";
import logger from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import { findJob } from "./registry";

/**
 * İç işlerin çalıştırma defteri.
 *
 * Her iç uç işini BUNUNLA sarar. Tek sorumluluk: işin çalıştığını, ne kadar
 * sürdüğünü ve sonucunu kaydetmek. İş mantığına karışmaz.
 *
 * Defter olmadan "iş çalışmıyor" tespit edilemez — 37 günlük slot kesintisi ve
 * 2 aylık 404 alan mutabakat cron'u tam olarak bu yüzden fark edilmedi (P1-11).
 */

export type JobOutcome<T> = { ok: true; detail?: T } | { ok: false; error: string };

/**
 * İşi çalıştırır ve sonucunu deftere yazar.
 *
 * DEFTER YAZIMI İŞİ ASLA BOZMAZ: kayıt başarısız olsa bile iş çalışır ve sonucu
 * döner. Gözlemlenebilirlik katmanının, gözlemlediği şeyi düşürmesi kabul edilemez.
 */
export async function withJobRun<T>(
  jobName: string,
  fn: () => Promise<JobOutcome<T>>,
): Promise<JobOutcome<T>> {
  if (!findJob(jobName)) {
    // Kayıt defterinde olmayan bir iş: sağlık kontrolü onu izleyemez.
    logger.warn({ job: jobName }, "job_run_unregistered");
  }

  const startedAt = new Date();
  let runId: string | null = null;
  try {
    const row = await prisma.jobRun.create({
      data: { job: jobName, startedAt, status: "RUNNING" },
      select: { id: true },
    });
    runId = row.id;
  } catch (err) {
    logger.error({ err, job: jobName }, "job_run_start_record_failed");
  }

  let outcome: JobOutcome<T>;
  try {
    outcome = await fn();
  } catch (err) {
    outcome = {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  if (runId) {
    try {
      await prisma.jobRun.update({
        where: { id: runId },
        data: {
          finishedAt,
          durationMs,
          status: outcome.ok ? "SUCCESS" : "FAILED",
          detail: (outcome.ok
            ? ((outcome.detail ?? {}) as Prisma.InputJsonValue)
            : ({ error: outcome.error } as Prisma.InputJsonValue)),
        },
      });
    } catch (err) {
      logger.error({ err, job: jobName, runId }, "job_run_finish_record_failed");
    }
  }

  logger[outcome.ok ? "info" : "error"](
    { job: jobName, durationMs, ok: outcome.ok },
    outcome.ok ? "job_run_success" : "job_run_failed",
  );

  return outcome;
}

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Yavas is erken uyarisi (2026-11-28): `call-internal-job.sh` isi 120 sn'de keser;
 * yarisini asan is `slowJobs`ta gorunur ama sagligi bozmaz.
 */
const { mockPrisma, warn } = vi.hoisted(() => ({
  mockPrisma: { jobRun: { groupBy: vi.fn(), findMany: vi.fn() } },
  warn: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({ default: { warn, error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/jobs/registry", () => ({
  JOB_REGISTRY: [
    { name: "generate-slots", what: "slot", cron: "17 4 * * *", enforced: true, maxStaleHours: 48 },
    { name: "cleanup", what: "temizlik", cron: "23 3 * * *", enforced: true, maxStaleHours: 72 },
  ],
}));

import { JobHealthService, SLOW_JOB_MS } from "@/services/JobHealthService";

const now = new Date("2026-11-28T09:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.jobRun.groupBy.mockImplementation(async (args: { _max: Record<string, boolean> }) =>
    ["generate-slots", "cleanup"].map((job) => ({
      job,
      _max: args._max.finishedAt ? { finishedAt: hoursAgo(5) } : { startedAt: hoursAgo(5) },
    })),
  );
});

describe("JobHealthService — yavas is", () => {
  it("esigi asan is slowJobs'ta, durum yine ok", async () => {
    mockPrisma.jobRun.findMany.mockResolvedValue([
      { job: "generate-slots", status: "SUCCESS", durationMs: SLOW_JOB_MS + 5_000 },
      { job: "cleanup", status: "SUCCESS", durationMs: 1_200 },
    ]);
    const report = await new JobHealthService().check(now);
    expect(report.status).toBe("ok");
    expect(report.slowJobs).toEqual(["generate-slots"]);
    expect(report.jobs.find((j) => j.job === "cleanup")?.lastDurationMs).toBe(1_200);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ thresholdMs: SLOW_JOB_MS }), "job_health_slow");
  });

  it("suresi bilinmeyen (calisan) is yavas sayilmaz", async () => {
    mockPrisma.jobRun.findMany.mockResolvedValue([
      { job: "generate-slots", status: "RUNNING", durationMs: null },
      { job: "cleanup", status: "SUCCESS", durationMs: 900 },
    ]);
    const report = await new JobHealthService().check(now);
    expect(report.slowJobs).toEqual([]);
    expect(report.jobs.find((j) => j.job === "generate-slots")?.lastDurationMs).toBeNull();
    expect(warn).not.toHaveBeenCalledWith(expect.anything(), "job_health_slow");
  });
});

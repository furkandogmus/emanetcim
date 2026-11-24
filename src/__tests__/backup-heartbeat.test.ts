import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import { NextRequest } from "next/server";

/**
 * Yedek kalp atisi (2026-11-24). `backup-s3.sh` basaridan sonra bu uca yazar;
 * gelmezse `/api/health/jobs` `backup-heartbeat` isini stale gosterir.
 */

const m = vi.hoisted(() => ({ withJobRun: vi.fn() }));
vi.mock("@/lib/jobs/run-ledger", () => ({ withJobRun: m.withJobRun }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { POST } from "@/app/api/internal/backup-heartbeat/route";
import { findJob } from "@/lib/jobs/registry";

const prev = process.env.CRON_SECRET;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
  m.withJobRun.mockImplementation(async (_n: string, fn: () => Promise<unknown>) => fn());
});
afterEach(() => {
  process.env.CRON_SECRET = prev;
});

const req = (secret?: string) =>
  new NextRequest("http://localhost/api/internal/backup-heartbeat", {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : {},
  });

describe("POST /api/internal/backup-heartbeat", () => {
  it("sirsiz istek deftere yazmaz", async () => {
    expect((await POST(req())).status).toBe(401);
    expect(m.withJobRun).not.toHaveBeenCalled();
  });

  it("CRON_SECRET ile basari kaydi yazar", async () => {
    const res = await POST(req("test-cron-secret"));
    expect(res.status).toBe(200);
    expect(m.withJobRun).toHaveBeenCalledWith("backup-heartbeat", expect.any(Function));
  });
});

describe("kayit defteri ve betik", () => {
  it("is izleniyor ve crontab uretimi onu atliyor", () => {
    const job = findJob("backup-heartbeat");
    expect(job?.enforced).toBe(true);
    expect(job?.hostTriggered).toBe(true);
    expect(fs.readFileSync("scripts/emit-crontab.sh", "utf-8")).toContain("hostTriggered");
  });

  it("backup-s3.sh fail-closed: alici yoksa yalniz BACKUP_ALLOW_PLAINTEXT=1 ile yukler, sonra kalp atisi", () => {
    const sh = fs.readFileSync("scripts/backup-s3.sh", "utf-8");
    expect(sh).toMatch(/read_setting BACKUP_ALLOW_PLAINTEXT "\$app_dir"\)" = "1"/);
    expect(sh).toContain("--job backup-heartbeat");
  });
});

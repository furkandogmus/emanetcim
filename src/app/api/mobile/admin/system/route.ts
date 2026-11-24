import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAppVersionGate } from "@/lib/app-version";
import { JOB_REGISTRY } from "@/lib/jobs/registry";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminSystem } from "@/lib/mobile-dto";
import { jobHealthService } from "@/services/JobHealthService";
import { systemStatusService } from "@/services/SystemStatusService";

const RECENT_RUNS = 30;

/**
 * Yonetici "Sistem" ekrani (salt okuma): web `/admin/status` + `/admin/jobs` tek yanitta.
 * Saglik skoru `SystemStatusService`, is gecikmesi `JobHealthService` (web ile ayni).
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const [status, jobs, runs, appVersions] = await Promise.all([
    systemStatusService.snapshot(),
    jobHealthService.check(),
    jobHealthService.recentRuns(RECENT_RUNS),
    getAppVersionGate(),
  ]);
  const explanations = Object.fromEntries(JOB_REGISTRY.map((j) => [j.name, j.ifItStops]));
  return NextResponse.json(toMobileAdminSystem({ status, jobs, explanations, runs, appVersions }));
}

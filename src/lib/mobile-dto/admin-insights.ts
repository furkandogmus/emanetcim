import type { SourceBreakdown } from "@/services/BookingSourceService";
import { toMobileBookingSourceBreakdown } from "./walk-in";
import type { JobHealthReport, JobRunRow } from "@/services/JobHealthService";
import type { SystemStatusSnapshot } from "@/services/SystemStatusService";
import type { analyticsService } from "@/services/AnalyticsService";
import type { prelaunchInterestService } from "@/services/PrelaunchInterestService";

/* ===================== Yonetici gorunurluk ekranlari (analitik, sistem, bildirim defteri, on acilis) ===================== */

type AnalyticsSummary = Awaited<ReturnType<(typeof analyticsService)["getDashboardSummary"]>>;

/** `admin/analytics`: huni sayilari + en cok goruntulenen sayfa/dukkan. */
export function toMobileAdminAnalytics(s: AnalyticsSummary, sources?: SourceBreakdown) {
  return {
    days: s.days,
    uniqueSessions: s.uniqueSessions,
    pageViews: s.pageViews,
    searches: s.searches,
    shopViews: s.shopViews,
    checkoutsStarted: s.checkoutsStarted,
    bookingsCreated: s.bookingsCreated,
    newUsers: s.newUsers,
    topPaths: s.topPaths.map((p) => ({ path: p.path, count: p.count })),
    topShops: s.topShops.map((p) => ({ shopId: p.shopId, name: p.name, count: p.count })),
    ...(sources ? { bookingSources: toMobileBookingSourceBreakdown(sources) } : {}),
  };
}

/** Is ayrintisi telefonda okunacak kadar: ham JSON 500 karakterde kesilir. */
const RUN_DETAIL_MAX = 500;

function runDetail(detail: unknown): string | null {
  if (detail === null || detail === undefined) return null;
  const s = JSON.stringify(detail);
  return s.length > RUN_DETAIL_MAX ? `${s.slice(0, RUN_DETAIL_MAX)}…` : s;
}

/**
 * `admin/system`: saglik anlik goruntusu + zamanlanmis isler + son calistirmalar.
 * `what` / `ifItStops` kayit defterinin operator metnidir (web ekraninda da cevrilmeden gorunur).
 */
export function toMobileAdminSystem(input: {
  status: SystemStatusSnapshot;
  jobs: JobHealthReport;
  explanations: Record<string, string>;
  runs: JobRunRow[];
  appVersions: { minAppVersion: string | null; latestAppVersion: string | null };
}) {
  const { status, jobs } = input;
  return {
    checkedAt: status.checkedAt,
    serverVersion: status.serverVersion,
    healthScore: status.healthScore,
    healthLevel: status.healthLevel,
    checks: { ...status.checks },
    emailFrom: status.emailFrom,
    runtime: { ...status.runtime },
    appVersions: { min: input.appVersions.minAppVersion, latest: input.appVersions.latestAppVersion },
    jobsStatus: jobs.status,
    enforcedStale: jobs.enforcedStale,
    neverRun: jobs.neverRun,
    jobs: jobs.jobs.map((j) => ({
      job: j.job,
      what: j.what,
      ifItStops: input.explanations[j.job] ?? null,
      cron: j.cron,
      enforced: j.enforced,
      status: j.status,
      lastSuccessAt: j.lastSuccessAt,
      lastRunAt: j.lastRunAt,
      lastRunStatus: j.lastRunStatus,
      hoursSinceSuccess: j.hoursSinceSuccess,
      maxStaleHours: j.maxStaleHours,
    })),
    runs: input.runs.map((r) => ({
      id: r.id,
      job: r.job,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      durationMs: r.durationMs,
      detail: runDetail(r.detail),
    })),
  };
}

type NotificationLogSource = {
  id: string;
  bookingId: string | null;
  type: string;
  recipient: string;
  subject: string | null;
  content: string;
  status: string;
  error: string | null;
  createdAt: Date;
};

/** `admin/notification-logs` satiri. Govde ekranda varsayilan olarak kapali gelir (kisisel veri). */
export function toMobileAdminNotificationLog(l: NotificationLogSource) {
  return {
    id: l.id,
    bookingId: l.bookingId,
    type: l.type,
    recipient: l.recipient,
    subject: l.subject,
    content: l.content,
    status: l.status,
    error: l.error,
    createdAt: l.createdAt.toISOString(),
  };
}

type PrelaunchReport = Awaited<ReturnType<(typeof prelaunchInterestService)["adminReport"]>>;

/** `admin/prelaunch`: sehir toplami ve ilgi alan noktalar (e-posta adresleri tasinmaz). */
export function toMobileAdminPrelaunch(r: PrelaunchReport) {
  return {
    totalPoints: r.totalPoints,
    silentCount: r.silentCount,
    cities: r.cities.map((c) => ({ city: c.city, count: c.count })),
    points: r.points.map((p) => ({
      shopId: p.shopId,
      shopName: p.shopName,
      city: p.city,
      district: p.district,
      wantCount: p.wantCount,
      interestCount: p.interestCount,
    })),
  };
}

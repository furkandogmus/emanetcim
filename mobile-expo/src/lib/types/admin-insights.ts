import type { BookingSourceBreakdown } from "./walk-in";
/* ===================== Yonetici gorunurluk ekranlari (kaynak: ../src/lib/mobile-dto/admin-insights.ts) ===================== */

/** `toMobileAdminAnalytics`. */
export type AdminAnalytics = {
  days: number;
  uniqueSessions: number;
  pageViews: number;
  searches: number;
  shopViews: number;
  checkoutsStarted: number;
  bookingsCreated: number;
  newUsers: number;
  topPaths: { path: string; count: number }[];
  topShops: { shopId: string; name: string; count: number }[];
  /** Rezervasyon kanallari; eski sunucuda yok. */
  bookingSources?: BookingSourceBreakdown;
};

export type AdminSystemCheck = "ok" | "missing" | "error";
export type AdminHealthLevel = "ok" | "warning" | "error";
export type AdminJobStatus = "ok" | "stale" | "never_run";

export type AdminSystemJob = {
  job: string;
  what: string;
  ifItStops: string | null;
  cron: string;
  enforced: boolean;
  status: AdminJobStatus;
  lastSuccessAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  hoursSinceSuccess: number | null;
  maxStaleHours: number;
};

export type AdminJobRun = {
  id: string;
  job: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  detail: string | null;
};

/** `toMobileAdminSystem`. */
export type AdminSystem = {
  checkedAt: string;
  serverVersion: string;
  healthScore: number;
  healthLevel: AdminHealthLevel;
  checks: { database: AdminSystemCheck; email: AdminSystemCheck; sms: AdminSystemCheck; authSecret: AdminSystemCheck };
  emailFrom: string | null;
  runtime: { node: string; next: string; platform: string; production: boolean; heapUsedMb: number; heapTotalMb: number };
  appVersions: { min: string | null; latest: string | null };
  jobsStatus: "ok" | "stale";
  enforcedStale: number;
  neverRun: number;
  jobs: AdminSystemJob[];
  runs: AdminJobRun[];
};

/** `toMobileAdminNotificationLog`. */
export type AdminNotificationLog = {
  id: string;
  bookingId: string | null;
  type: string;
  recipient: string;
  subject: string | null;
  content: string;
  status: string;
  error: string | null;
  createdAt: string;
};

export type AdminNotificationLogPage = {
  items: AdminNotificationLog[];
  nextCursor?: string | null;
  /** Yalniz ilk sayfada. */
  facets?: { types: string[]; statuses: string[]; failedCount: number };
};

/** `toMobileAdminPrelaunch`. */
export type AdminPrelaunch = {
  totalPoints: number;
  silentCount: number;
  cities: { city: string; count: number }[];
  points: {
    shopId: string;
    shopName: string;
    city: string | null;
    district: string | null;
    wantCount: number;
    interestCount: number;
  }[];
};

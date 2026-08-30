"use client";

import { useState } from "react";
import { ArrowLeft, Clock, CheckCircle2, AlertTriangle, MinusCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import type { JobHealthReport } from "@/services/JobHealthService";

type Run = {
  id: string;
  job: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  detail: string | null;
};

const STATUS_ICON = {
  ok: CheckCircle2,
  stale: AlertTriangle,
  never_run: MinusCircle,
} as const;

const STATUS_COLOR = {
  ok: "text-emerald-600 bg-emerald-50",
  stale: "text-red-600 bg-red-50",
  never_run: "text-gray-400 bg-gray-50",
} as const;

export default function AdminJobsClient({
  report,
  explanations,
  runs,
}: {
  report: JobHealthReport;
  explanations: Record<string, { ifItStops: string; method: string }>;
  runs: Run[];
}) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const dateLocale = bcp47ForUiLocale(locale);
  const [openRun, setOpenRun] = useState<string | null>(null);

  function fmt(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(dateLocale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs id-eyebrow text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={14} />
          {t("backToDashboard")}
        </Link>

        <h1 className="text-3xl id-display text-gray-900 mb-1">
          {t("jobsTitle")}
        </h1>
        <p className="text-sm text-gray-500 mb-8">{t("jobsIntro")}</p>

        {report.enforcedStale > 0 ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">{t("jobsStaleBanner")}</p>
              <p className="text-xs text-red-600">
                {t("jobsStaleCount", { count: report.enforcedStale })}
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-4 mb-10">
          {report.jobs.map((j) => {
            const Icon = STATUS_ICON[j.status];
            const explain = explanations[j.job];
            return (
              <div key={j.job} className="id-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className={`p-2 rounded-xl ${STATUS_COLOR[j.status]}`}>
                      <Icon size={16} />
                    </span>
                    <div>
                      <p className="id-display text-gray-900">{j.job}</p>
                      <p className="text-xs text-gray-500 max-w-xl">{j.what}</p>
                      {j.status !== "ok" && explain ? (
                        <p className="text-xs text-red-600 mt-2 max-w-xl">
                          {t("jobsIfItStops")}: {explain.ifItStops}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500 space-y-1">
                    <div className="flex items-center justify-end gap-1">
                      <Clock size={12} />
                      <code className="text-gray-400">{j.cron}</code>
                    </div>
                    <div>
                      {t("jobsLastSuccess")}: {fmt(j.lastSuccessAt)}
                    </div>
                    <div>
                      {t("jobsLastRun")}: {fmt(j.lastRunAt)}
                      {j.lastRunStatus ? ` · ${j.lastRunStatus}` : ""}
                    </div>
                    {!j.enforced ? (
                      <span className="inline-block px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 text-[10px] id-eyebrow">
                        {t("jobsNotEnforced")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <h2 className="text-xl id-display text-gray-900 mb-4">
          {t("jobsRecentRuns")}
        </h2>

        <div className="id-surface divide-y divide-gray-100">
          {runs.length === 0 ? (
            <p className="p-12 text-center text-sm text-gray-400">{t("jobsNoRuns")}</p>
          ) : (
            runs.map((r) => {
              const open = openRun === r.id;
              return (
                <div key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] id-eyebrow ${
                          r.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-700"
                            : r.status === "FAILED"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {r.status}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{r.job}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{fmt(r.startedAt)}</span>
                      <span>{r.durationMs !== null ? `${r.durationMs} ms` : "—"}</span>
                      {r.detail ? (
                        <button
                          type="button"
                          onClick={() => setOpenRun(open ? null : r.id)}
                          className="hover:text-gray-900 flex items-center gap-1"
                        >
                          {t("viewRawData")}
                          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {open && r.detail ? (
                    <pre className="mt-3 p-3 bg-gray-50 rounded-xl text-[11px] text-gray-600 overflow-x-auto">
                      {r.detail}
                    </pre>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

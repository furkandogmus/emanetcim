"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Star } from "lucide-react";
import { Link } from "@/i18n/routing";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { moderateReviewAction } from "@/actions/review-moderation";
import { actionErrorKey } from "@/lib/action-error";
import { formatInstant } from "@/lib/format-datetime";

export type AdminReviewRowVm = {
  id: string;
  rating: number;
  comment: string | null;
  createdAtIso: string;
  guestName: string;
  shop: { id: string; name: string };
  hidden: boolean;
  autoHidden: boolean;
  hiddenReason: string | null;
  openReportCount: number;
  reports: { reason: string; note: string | null }[];
};

type Action = "hide" | "unhide" | "delete";
const FILTERS = ["reported", "all", "low", "hidden"] as const;

export default function AdminReviewsClient({
  rows,
  filter,
  total,
}: {
  rows: AdminReviewRowVm[];
  filter: string;
  total: number;
}) {
  const t = useTranslations("AdminReviews");
  const tReview = useTranslations("Review");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [pending, setPending] = useState<{ row: AdminReviewRowVm; action: Action } | null>(null);
  const [reason, setReason] = useState("");

  const run = () => {
    if (!pending) return;
    const { row, action } = pending;
    setPending(null);
    startTransition(async () => {
      try {
        const r = await moderateReviewAction({ reviewId: row.id, action, reason: reason.trim() || undefined });
        if (!r.success) {
          toast.error(tErrors(r.error.replace(/^Errors\./, "") as never));
          return;
        }
        toast.success(t(`done_${action}` as never));
        router.refresh();
      } catch (e) {
        toast.error(tErrors(actionErrorKey(e) as never));
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
      <header className="mb-8">
        <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-gray-500 hover:text-gray-900">
          <ArrowLeft size={16} />
          <span className="text-xs id-eyebrow">{t("back")}</span>
        </Link>
        <h1 className="text-4xl id-display tracking-tighter text-gray-900">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-600">{t("intro")}</p>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label={t("title")}>
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={`/admin/reviews?filter=${f}`}
              aria-current={filter === f ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-xs id-eyebrow ${filter === f ? "bg-gray-900 text-white" : "bg-white text-gray-700 border border-gray-200"}`}
            >
              {t(`filter_${f}` as never)}
            </Link>
          ))}
        </nav>
        <p className="mt-2 text-xs text-gray-500">{t("total", { count: total })}</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white px-8 py-16 text-center text-sm font-bold text-gray-400">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.id} className={`rounded-2xl border border-gray-100 p-6 shadow-sm ${row.hidden ? "bg-gray-100" : "bg-white"}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Star size={14} className="text-orange-600" fill="currentColor" />
                <span className="font-bold">{row.rating}</span>
                <span className="text-gray-600">
                  {row.guestName || "—"} · {formatInstant(row.createdAtIso, locale, { dateStyle: "medium" })}
                </span>
                <Link href={`/shop/${row.shop.id}`} className="text-orange-600 underline">
                  {row.shop.name}
                </Link>
                {row.openReportCount > 0 ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                    {t("reportCount", { count: row.openReportCount })}
                  </span>
                ) : null}
                {row.hidden ? (
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700">
                    {row.autoHidden ? t("autoHidden") : t("hidden")}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-gray-800">{row.comment || t("noComment")}</p>
              {row.hiddenReason ? <p className="mt-1 text-xs text-gray-500">{t("hiddenBecause", { reason: row.hiddenReason })}</p> : null}
              {row.reports.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-red-800">
                  {row.reports.map((r, i) => (
                    <li key={i}>
                      {tReview(`reportReason_${r.reason}` as never)}
                      {r.note ? `: ${r.note}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setReason("");
                    setPending({ row, action: row.hidden ? "unhide" : "hide" });
                  }}
                  className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-xs id-eyebrow text-gray-900 hover:bg-gray-50 disabled:opacity-40"
                >
                  {t(row.hidden ? "unhide" : "hide")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setReason("");
                    setPending({ row, action: "delete" });
                  }}
                  className="rounded-full bg-red-600 px-5 py-2.5 text-xs id-eyebrow text-white hover:bg-red-700 disabled:opacity-40"
                >
                  {t("delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={t(`confirmTitle_${pending?.action ?? "hide"}` as never)}
        message={t(`confirmBody_${pending?.action ?? "hide"}` as never)}
        confirmLabel={t(pending?.action ?? "hide")}
        cancelLabel={tCommon("cancel")}
        onConfirm={run}
        onCancel={() => setPending(null)}
        confirmDisabled={pending?.action === "hide" && reason.trim().length === 0}
      >
        {pending && pending.action !== "unhide" ? (
          <label className="mt-3 block text-sm font-bold text-gray-700">
            {t("reasonLabel")}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm font-normal"
            />
          </label>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

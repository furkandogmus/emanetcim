"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { updateDisputeStatusAction } from "@/actions/dispute";
import { toast } from "sonner";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import { adminDisputeErrorKey } from "@/lib/admin-dispute-error-copy";
import Money from "@/components/common/Money";

interface DisputeBooking {
  id: string;
  totalPrice: number;
  checkInTime: string;
  checkOutTime: string;
  status: string;
  guest: { name: string | null; email: string | null } | null;
  shop: { name: string } | null;
}

interface Dispute {
  id: string;
  bookingId: string;
  reason: string;
  description: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  booking: DisputeBooking;
}

const STATUS_OPTIONS = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"] as const;

const STATUS_I18N = {
  OPEN: "statusDisputeOpen",
  IN_REVIEW: "statusDisputeInReview",
  RESOLVED: "statusDisputeResolved",
  CLOSED: "statusDisputeClosed",
} as const;

const REASON_I18N: Record<string, "reasonDisputeDamage" | "reasonDisputeTheft" | "reasonDisputeOther"> = {
  DAMAGE: "reasonDisputeDamage",
  THEFT: "reasonDisputeTheft",
  OTHER: "reasonDisputeOther",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

export default function AdminDisputesClient({ disputes: initial }: { disputes: Dispute[] }) {
  const t = useTranslations("Admin");
  const tErrors = useTranslations("Errors");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const dateLocale = bcp47ForUiLocale(locale);

  const [disputes, setDisputes] = useState(initial);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(dateLocale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function statusLabel(status: string) {
    if (status in STATUS_I18N) {
      return t(STATUS_I18N[status as keyof typeof STATUS_I18N]);
    }
    return status;
  }

  function reasonLabel(reason: string) {
    const key = REASON_I18N[reason];
    return key ? t(key) : reason;
  }

  const filtered =
    filter === "ALL" ? disputes : disputes.filter((d) => d.status === filter);

  function startEdit(d: Dispute) {
    setEditId(d.id);
    setEditStatus(d.status);
    setEditNote(d.adminNote ?? "");
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await updateDisputeStatusAction(id, editStatus, editNote || undefined);
      if (res.success) {
        setDisputes((prev) =>
          prev.map((d) =>
            d.id === id
              ? { ...d, status: editStatus, adminNote: editNote || null }
              : d
          )
        );
        setEditId(null);
        toast.success(t("disputesToastUpdated"));
      } else {
        toast.error(
          t("disputesToastError", { error: tErrors(adminDisputeErrorKey(res.error)) }),
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/admin" aria-label={tCommon("back")} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-gray-900">{t("disputesPageTitle")}</h1>
            <p className="text-sm text-gray-500">{t("disputesPageRecords", { count: disputes.length })}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(["ALL", ...STATUS_OPTIONS] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === s
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
              }`}
            >
              {s === "ALL" ? t("disputesFilterAll") : statusLabel(s)}
              {s !== "ALL" && (
                <span className="ml-1 text-xs opacity-70">
                  ({disputes.filter((d) => d.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400">{t("disputesEmpty")}</div>
        )}

        {filtered.map((d) => (
          <div
            key={d.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {d.booking.shop?.name ?? "—"} —{" "}
                  {d.booking.guest?.name ?? d.booking.guest?.email ?? t("disputesGuestFallback")}
                </p>
                <p className="text-xs text-gray-400">
                  {reasonLabel(d.reason)} · {fmtDate(d.createdAt)} ·{" "}
                  <Money amount={d.booking.totalPrice} />
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status] ?? "bg-gray-100 text-gray-600"}`}
              >
                {statusLabel(d.status)}
              </span>
              {expanded === d.id ? (
                <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </button>

            {expanded === d.id && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{t("disputesLabelBooking")}</p>
                    <Link
                      href={`/bookings/${d.bookingId}`}
                      className="font-mono text-blue-600 hover:underline text-xs"
                    >
                      {d.bookingId.slice(0, 8)}…
                    </Link>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{t("disputesLabelGuest")}</p>
                    <p className="text-gray-900">{d.booking.guest?.email ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{t("disputesLabelCheckIn")}</p>
                    <p className="text-gray-900">{fmtDate(d.booking.checkInTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{t("disputesLabelCheckOut")}</p>
                    <p className="text-gray-900">{fmtDate(d.booking.checkOutTime)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-1">{t("disputesLabelDescription")}</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{d.description}</p>
                </div>

                {d.adminNote && editId !== d.id && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t("disputesLabelAdminNote")}</p>
                    <p className="text-sm text-gray-700 bg-amber-50 rounded-xl p-3">{d.adminNote}</p>
                  </div>
                )}

                {editId === d.id ? (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label htmlFor={`dispute-status-${d.id}`} className="text-xs text-gray-500 mb-1 block">
                        {t("disputesLabelStatus")}
                      </label>
                      <select
                        id={`dispute-status-${d.id}`}
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`dispute-note-${d.id}`} className="text-xs text-gray-500 mb-1 block">
                        {t("disputesLabelAdminNote")}
                      </label>
                      <textarea
                        id={`dispute-note-${d.id}`}
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        rows={3}
                        placeholder={t("disputesNotePlaceholder")}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(d.id)}
                        disabled={saving}
                        className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                        {t("disputesSave")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="px-4 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        {t("disputesCancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(d)}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {t("disputesEdit")}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

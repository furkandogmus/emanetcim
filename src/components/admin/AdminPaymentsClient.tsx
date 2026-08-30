"use client";

import { ArrowLeft, CreditCard, RotateCcw, Split, XCircle } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import Money from "@/components/common/Money";

const STATUS_OPTIONS = [
  "ALL",
  "PENDING",
  "AUTHORIZED",
  "SUCCESS",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CANCELLED",
] as const;

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  AUTHORIZED: "bg-blue-100 text-blue-700",
  SUCCESS: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-amber-100 text-amber-700",
  PARTIALLY_REFUNDED: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const ACCOUNT_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-500",
  PENDING: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-red-100 text-red-700",
};

type Payment = {
  id: string;
  bookingId: string;
  status: string;
  provider: string;
  amount: number;
  refundedAmount: number;
  failureReason: string | null;
  chargebackStatus: string | null;
  createdAt: string;
  capturedAt: string | null;
  guestLabel: string | null;
  shopName: string;
  splitStatus: string | null;
  merchantAmount: number | null;
  platformCommission: number | null;
};

type Account = {
  id: string;
  shopName: string;
  city: string | null;
  provider: string;
  status: string;
  rejectionReason: string | null;
  activatedAt: string | null;
};

export default function AdminPaymentsClient({
  status,
  summary,
  payments,
  accounts,
}: {
  status: string;
  summary: {
    capturedAmount: number;
    capturedCount: number;
    refundedAmount: number;
    pendingSplitAmount: number;
    pendingSplitCount: number;
    failedCount: number;
  };
  payments: Payment[];
  accounts: Account[];
}) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const router = useRouter();
  const dateLocale = bcp47ForUiLocale(locale);

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
      <div className="max-w-7xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs id-eyebrow text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={14} />
          {t("backToDashboard")}
        </Link>

        <h1 className="text-3xl id-display text-gray-900 mb-1">
          {t("paymentsTitle")}
        </h1>
        <p className="text-sm text-gray-500 mb-8">{t("paymentsIntro")}</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="id-surface p-5">
            <div className="flex items-center gap-2 text-[10px] id-eyebrow text-gray-500 mb-2">
              <CreditCard size={13} />
              {t("paymentsCaptured")}
            </div>
            <p className="text-2xl id-display text-gray-900">
              <Money amount={summary.capturedAmount} />
            </p>
            <p className="text-xs text-gray-400">{summary.capturedCount}</p>
          </div>
          <div className="id-surface p-5">
            <div className="flex items-center gap-2 text-[10px] id-eyebrow text-gray-500 mb-2">
              <RotateCcw size={13} />
              {t("paymentsRefunded")}
            </div>
            <p className="text-2xl id-display text-gray-900">
              <Money amount={summary.refundedAmount} />
            </p>
          </div>
          <div className="id-surface p-5">
            <div className="flex items-center gap-2 text-[10px] id-eyebrow text-gray-500 mb-2">
              <Split size={13} />
              {t("paymentsPendingSplit")}
            </div>
            <p className="text-2xl id-display text-gray-900">
              <Money amount={summary.pendingSplitAmount} />
            </p>
            <p className="text-xs text-gray-400">{summary.pendingSplitCount}</p>
          </div>
          <div className="id-surface p-5">
            <div className="flex items-center gap-2 text-[10px] id-eyebrow text-gray-500 mb-2">
              <XCircle size={13} />
              {t("paymentsFailedCount")}
            </div>
            <p className="text-2xl id-display text-gray-900">
              {summary.failedCount}
            </p>
          </div>
        </div>

        <div className="mb-4 max-w-xs">
          <label
            htmlFor="admin-payment-status"
            className="block text-xs id-eyebrow text-gray-500 mb-2"
          >
            {t("status")}
          </label>
          <select
            id="admin-payment-status"
            value={status}
            onChange={(e) =>
              router.push(
                e.target.value === "ALL"
                  ? "/admin/payments"
                  : `/admin/payments?status=${e.target.value}`,
              )
            }
            className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? t("bookingStatusAll") : t(`paymentStatus_${s}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="id-surface overflow-hidden mb-10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr className="text-[10px] id-eyebrow text-gray-500">
                  <th className="px-5 py-4">{t("date")}</th>
                  <th className="px-5 py-4">{t("bookingsColGuest")}</th>
                  <th className="px-5 py-4">{t("shopColumn")}</th>
                  <th className="px-5 py-4">{t("status")}</th>
                  <th className="px-5 py-4">{t("paymentsSplitStatus")}</th>
                  <th className="px-5 py-4 text-right">{t("paymentsAmount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                      {t("paymentsEmpty")}
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-xs text-gray-500">{fmt(p.createdAt)}</td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/bookings/${p.bookingId}`}
                          className="font-bold text-gray-900 hover:text-[color:var(--id-accent)]"
                        >
                          {p.guestLabel ?? t("anonymous")}
                        </Link>
                        <div className="text-xs text-gray-400">{p.provider}</div>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{p.shopName}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[10px] id-eyebrow ${
                            STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {t(`paymentStatus_${p.status}`)}
                        </span>
                        {p.failureReason ? (
                          <div className="text-[11px] text-red-600 mt-1">{p.failureReason}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {p.splitStatus ? t(`splitStatus_${p.splitStatus}`) : t("paymentsNoSplit")}
                        {p.merchantAmount !== null ? (
                          <div className="text-gray-400">
                            <Money amount={p.merchantAmount} />
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-gray-900">
                        <Money amount={p.amount} />
                        {p.refundedAmount > 0 ? (
                          <div className="text-[11px] font-normal text-amber-600">
                            −<Money amount={p.refundedAmount} />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="text-xl id-display text-gray-900 mb-1">
          {t("paymentsAccountsTitle")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">{t("paymentsAccountsIntro")}</p>

        <div className="id-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr className="text-[10px] id-eyebrow text-gray-500">
                  <th className="px-5 py-4">{t("shopColumn")}</th>
                  <th className="px-5 py-4">{t("paymentsProvider")}</th>
                  <th className="px-5 py-4">{t("status")}</th>
                  <th className="px-5 py-4">{t("paymentsActivatedAt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-gray-400">
                      {t("paymentsAccountsEmpty")}
                    </td>
                  </tr>
                ) : (
                  accounts.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-bold text-gray-900">{a.shopName}</span>
                        {a.city ? (
                          <div className="text-xs text-gray-400">{a.city}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-gray-600">{a.provider}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[10px] id-eyebrow ${
                            ACCOUNT_COLORS[a.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {t(`merchantAccountStatus_${a.status}`)}
                        </span>
                        {a.rejectionReason ? (
                          <div className="text-[11px] text-red-600 mt-1">{a.rejectionReason}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">{fmt(a.activatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

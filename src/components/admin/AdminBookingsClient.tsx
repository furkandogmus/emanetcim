"use client";

import { useState } from "react";
import { Search, ArrowLeft, Package, AlertTriangle } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import Money from "@/components/common/Money";
import type { AdminBookingRow } from "@/lib/admin/booking-search";

const STATUS_OPTIONS = [
  "ALL",
  "PENDING",
  "WAITING_APPROVAL",
  "APPROVED",
  "PAID",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
] as const;

/** Durum rozeti renkleri — okunurluk için, anlam taşımaz. */
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  WAITING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700",
  CHECKED_IN: "id-accent-soft",
  CHECKED_OUT: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function AdminBookingsClient({
  bookings,
  query,
  status,
}: {
  bookings: AdminBookingRow[];
  query: string;
  status: string;
}) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const router = useRouter();
  const dateLocale = bcp47ForUiLocale(locale);

  const [q, setQ] = useState(query);
  const [statusValue, setStatusValue] = useState(status);

  /*
    Arama SUNUCUDA calisiyor; form gonderimi URL'i degistirir ve sayfa yeniden
    veri ceker. Istemcide filtreleseydik yalnizca ekrandaki 50 kaydi
    filtrelerdik -- yani aranan kayit orada degilse "bulunamadi" derdik.
  */
  function submit(nextStatus = statusValue) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    const qs = params.toString();
    router.push(qs ? `/admin/bookings?${qs}` : "/admin/bookings");
  }

  function fmtDateTime(iso: string) {
    return new Date(iso).toLocaleString(dateLocale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
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
          {t("bookingsSearchTitle")}
        </h1>
        <p className="text-sm text-gray-500 mb-8">{t("bookingsSearchIntro")}</p>

        <form
          className="id-surface p-5 mb-6 flex flex-col md:flex-row gap-4 md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex-1">
            <label
              htmlFor="admin-booking-search"
              className="block text-xs id-eyebrow text-gray-500 mb-2"
            >
              {t("bookingsSearchLabel")}
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                id="admin-booking-search"
                type="search"
                aria-label={t("bookingsSearchLabel")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("bookingsSearchPlaceholder")}
                className="w-full h-12 pl-11 pr-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
              />
            </div>
          </div>

          <div className="md:w-56">
            <label
              htmlFor="admin-booking-status"
              className="block text-xs id-eyebrow text-gray-500 mb-2"
            >
              {t("status")}
            </label>
            <select
              id="admin-booking-status"
              value={statusValue}
              onChange={(e) => {
                setStatusValue(e.target.value);
                submit(e.target.value);
              }}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--id-accent)]"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? t("bookingStatusAll") : t(`bookingStatus_${s}`)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="h-12 px-6 rounded-2xl bg-gray-900 text-white text-xs id-eyebrow hover:bg-black transition-colors"
          >
            {t("bookingsSearchSubmit")}
          </button>
        </form>

        {bookings.length === 0 ? (
          <div className="id-surface p-12 text-center">
            <Package size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">{t("bookingsSearchEmpty")}</p>
          </div>
        ) : (
          <div className="id-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr className="text-[10px] id-eyebrow text-gray-500">
                    <th className="px-5 py-4">{t("bookingsColGuest")}</th>
                    <th className="px-5 py-4">{t("shopColumn")}</th>
                    <th className="px-5 py-4">{t("bookingsColWindow")}</th>
                    <th className="px-5 py-4">{t("status")}</th>
                    <th className="px-5 py-4">{t("bookingsColPayment")}</th>
                    <th className="px-5 py-4 text-right">{t("bookingsColTotal")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="font-bold text-gray-900 hover:text-[color:var(--id-accent)]"
                        >
                          {b.guestLabel ?? t("anonymous")}
                        </Link>
                        <div className="text-xs text-gray-400">
                          {b.guestEmail ?? b.guestPhone ?? b.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{b.shopName}</td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {fmtDateTime(b.checkInTime)}
                        <br />
                        {fmtDateTime(b.checkOutTime)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[10px] id-eyebrow ${
                            STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {t(`bookingStatus_${b.status}`)}
                        </span>
                        {b.hasDispute ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] id-eyebrow text-red-600">
                            <AlertTriangle size={11} />
                            {t("bookingsHasDispute")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {b.paymentStatus
                          ? t(`paymentStatus_${b.paymentStatus}`)
                          : t("bookingsNoPaymentRow")}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-gray-900">
                        <Money amount={b.totalPrice} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

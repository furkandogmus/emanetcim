"use client";

import { useTranslations } from "next-intl";
import { Loader2, Luggage, Package } from "lucide-react";
import type { PartnerBookingListItem } from "@/services/BookingService";
import { moneyToNumber } from "@/lib/money";
import type { computeOverdue } from "@/lib/overdue-display";

interface PartnerHistoryTabProps {
  bookings: PartnerBookingListItem[];
  merchantShareRatio: number;
  dateLocale: string;
  overdueOf: (checkOutTime: string | Date) => ReturnType<typeof computeOverdue>;
  checkingOutId: string | null;
  onCheckout: (bookingId: string) => void;
}

/** Esnaf paneli "geçmiş" sekmesi: tüm rezervasyonlar, gecikme rozeti, teslim butonu. */
export default function PartnerHistoryTab({
  bookings,
  merchantShareRatio,
  dateLocale,
  overdueOf,
  checkingOutId,
  onCheckout,
}: PartnerHistoryTabProps) {
  const t = useTranslations("Partner");
  return (
    <div className="flex-1 flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
      <header className="flex items-center justify-between">
        <h2 className="text-xl id-eyebrow tracking-tight">
          {t("transactionHistory")}
        </h2>
        <div className="px-4 py-2 bg-orange-100 text-orange-600 rounded-2xl text-[10px] font-black uppercase">
          {t("transactionsCount", { count: bookings.length })}
        </div>
      </header>

      <div className="flex flex-col gap-4 pb-32">
        {bookings.length === 0 ? (
          <div className="ui-state ui-state-empty p-12 rounded-4xl text-center flex flex-col items-center gap-4">
            <Package size={48} strokeWidth={1} />
            <p className="font-bold">{t("noTransactionsYet")}</p>
          </div>
        ) : (
          [...bookings]
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .map((booking) => (
              <div
                key={booking.id}
                className="bg-white p-6 rounded-4xl border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col gap-6 hover:translate-y-[-4px] transition-all group overflow-hidden relative"
              >
                <div className="flex justify-between items-start relative z-10">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-orange-600 group-hover:text-white transition-all">
                      <Luggage size={24} />
                    </div>
                    {/*
                      `min-w-0` + `truncate`: uzun misafir adı kart düzenini
                      bozuyordu (flex öğesi varsayılan `min-width: auto`).
                    */}
                    <div className="min-w-0">
                      <h3 className="truncate font-black text-gray-900 tracking-tight">
                        {booking.guest?.name ||
                          t("guestFallback", { id: booking.id.slice(0, 4) })}
                      </h3>
                      <p className="id-eyebrow text-gray-400">
                        {new Date(booking.checkInTime).toLocaleDateString(
                          dateLocale
                        )}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm ${
                      booking.status === "CHECKED_OUT"
                        ? "bg-green-100 text-green-600"
                        : booking.status === "CANCELLED"
                          ? "bg-red-100 text-red-600"
                          : booking.status === "CHECKED_IN"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-orange-50 text-orange-500"
                    }`}
                  >
                    {(booking.status as string) === "CHECKED_OUT" && t("statusCheckedOut")}
                    {(booking.status as string) === "CANCELLED" && t("statusCancelled")}
                    {(booking.status as string) === "CHECKED_IN" && t("statusCheckedIn")}
                    {(booking.status as string) === "PAID" && t("statusPaid")}
                    {(booking.status as string) === "PENDING" && t("statusPending")}
                    {(booking.status as string) === "APPROVED" && t("statusApproved")}
                    {(booking.status as string) === "WAITING_APPROVAL" && t("statusWaitingApproval")}
                    {!["CHECKED_OUT", "CANCELLED", "CHECKED_IN", "PAID", "PENDING", "APPROVED", "WAITING_APPROVAL"].includes(booking.status as string) && booking.status}
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-gray-50 pt-6">
                  <div className="flex flex-col gap-1">
                    <p className="id-eyebrow text-gray-400">
                      {t("netEarningsShort")}
                    </p>
                    <p className="font-black text-xl text-gray-900">
                      {(booking.status as string) === "CANCELLED"
                        ? "0"
                        : Math.round(
                            moneyToNumber(booking.totalPrice) *
                              merchantShareRatio *
                              100
                          ) / 100}
                      <span className="text-[10px] ml-1 opacity-40 uppercase">
                        TL
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="id-eyebrow text-gray-400">
                      {t("bagLabel")}
                    </p>
                    <p className="font-black text-gray-900 tracking-tight">
                      {booking.bagCountS + booking.bagCountM + booking.bagCountXl}{" "}
                      {t("bagCountUnit")}
                    </p>
                  </div>
                </div>

                {/*
                  GECİKME ROZETİ.

                  Çıkış butonu zaten vardı ve liste tarih filtresi taşımıyor —
                  yani Haziran'dan kalan bir rezervasyon da ekranda duruyordu.
                  Sorun görünürlük değil, AYIRT EDİLEBİLİRLİKTİ: o kayıt
                  listede dünkü bir rezervasyondan hiçbir farkla görünmüyordu
                  ve partnere "burada bekleyen bir iş var" diyen hiçbir sinyal
                  yoktu. Prod'da 19 rezervasyonun 18'i böyle bekliyordu
                  (P1-6 / P1-22).
                */}
                {(booking.status as string) === "CHECKED_IN" &&
                overdueOf(booking.checkOutTime).severity !== "none" ? (
                  <div
                    className={`mb-3 rounded-2xl px-4 py-3 ${
                      overdueOf(booking.checkOutTime).severity === "critical"
                        ? "bg-red-50 border border-red-200"
                        : overdueOf(booking.checkOutTime).severity === "late"
                          ? "bg-amber-50 border border-amber-200"
                          : "bg-gray-50 border border-gray-200"
                    }`}
                  >
                    <p
                      className={`text-xs font-black ${
                        overdueOf(booking.checkOutTime).severity === "critical"
                          ? "text-red-700"
                          : overdueOf(booking.checkOutTime).severity === "late"
                            ? "text-amber-800"
                            : "text-gray-600"
                      }`}
                    >
                      {overdueOf(booking.checkOutTime).overdueDays >= 1
                        ? t("overdueBadgeDays", {
                            days: overdueOf(booking.checkOutTime).overdueDays,
                          })
                        : t("overdueBadgeHours", {
                            hours: overdueOf(booking.checkOutTime).overdueHours,
                          })}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-gray-500">
                      {t("overdueHint")}
                    </p>
                  </div>
                ) : null}

                {(booking.status as string) === "CHECKED_IN" && (
                  <button
                    type="button"
                    disabled={checkingOutId === booking.id}
                    onClick={() => onCheckout(booking.id)}
                    className="btn-ui btn-ui-lg btn-ui-primary w-full rounded-2xl bg-gray-900 hover:bg-black"
                  >
                    {checkingOutId === booking.id ? (
                      <Loader2 className="inline animate-spin w-5 h-5" />
                    ) : (
                      t("deliveryCheckoutShort")
                    )}
                  </button>
                )}

                <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-bl-[4rem] -z-0 translate-x-8 -translate-y-8 opacity-0 group-hover:opacity-100 transition-all"></div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { toast } from "sonner";
import { MapPin, Calendar, Clock, Luggage, CheckCircle2, XCircle } from "lucide-react";
import Money from "@/components/common/Money";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import { formatDateTimeInZone } from "@/lib/format-datetime";
import { useActionErrorText } from "@/lib/use-action-error";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { guestBookingStatusMessageKey } from "@/lib/booking-status-i18n";
import BagRevisionApproval, { type PendingBagRevisionInfo } from "@/components/guest/BagRevisionApproval";

interface BookingInfo {
  id: string;
  shopName: string;
  shopAddress: string;
  /** Dukkanin saat dilimi -- saatler bunda gosterilir. */
  shopTimeZone: string;
  checkInTime: string;
  checkOutTime: string;
  totalPrice: number;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  status: string;
  qrCodeToken: string | null;
  pendingBagRevision: Partial<PendingBagRevisionInfo> | null;
}

export default function ManageBookingClient({ initialToken }: { initialToken: string }) {
  const t = useTranslations("Guest");
  const errorText = useActionErrorText();
  const locale = useLocale();
  const dateLocale = bcp47ForUiLocale(locale);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelFullRefund, setCancelFullRefund] = useState(false);
  const [token] = useState(initialToken);
  /*
    ConfirmDialog KULLANILIR (2026-09-10'da bulundu): hesapsiz (token'la
    erisilen, e-posta ile paylasilan) bu sayfa iptali `confirm()` -- tarayici
    kromu -- arkasina birakiyordu. Mobil webview'ler bunu bilinen sekilde
    kapatabiliyor; projenin geri kalanindaki yikici onaylar ConfirmDialog
    kullaniyor.
  */
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refetchBooking = useCallback(() => {
    return fetch(`/api/bookings/lookup/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(d => {
      if (d.ok) setBooking(d.booking);
      // Suresi dolmus baglanti en sik sebep; `errorText` kodu ona cevirir.
      else toast.error(errorText(d.error, t("bookingLookupError")));
    }).catch(() => toast.error(t("bookingLookupError")));
  }, [token, t, errorText]);

  useEffect(() => {
    refetchBooking().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /*
    HESAPSIZ misafir icin onay/red -- `guest-bag-revision` ucu ayni govdeyi
    (`BookingService.applyBagRevision`/`clearBagRevision`) token'la cagirir.
    `BagRevisionApproval` hesapli misafir icin server action'lari varsayar;
    bu iki fonksiyon onlari token tabanli fetch'le degistirir.
  */
  const decideBagRevision = async (action: "approve" | "reject") => {
    const res = await fetch("/api/bookings/guest-bag-revision", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    return { success: !!data.ok, error: data.error as string | undefined };
  };

  const handleCancel = async () => {
    setConfirmOpen(false);
    setCancelling(true);
    try {
      const res = await fetch("/api/bookings/guest-cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        /*
          `fullRefund` OKUNUYOR (2026-09-10). Onceden bu sayfa iptal sonrasi
          HER ZAMAN "odemeniz tamamen iade edilecek" diyordu -- platformun
          "dukkanda ode" modelinde cogu iptalde hicbir tahsilat olmamisken.
          Kardeş bilesen (`BookingsClient.tsx`) `res.fullRefund`e gore
          zaten dallaniyor; bu sayfa `data.ok` disinda hicbir seye bakmiyordu.
        */
        setCancelFullRefund(!!data.fullRefund);
        setCancelled(true);
        toast.success(t("cancelSuccess"));
      } else {
        // `data.error` bir KOD; ham basilirsa misafir "email_mismatch" okur.
        toast.error(errorText(data.error, t("cancelError")));
      }
    } catch {
      toast.error(t("cancelError"));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-orange-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <XCircle size={48} className="text-gray-300 mb-4" />
        <h1 className="text-xl font-black text-gray-900">{t("bookingNotFound")}</h1>
        <p className="text-sm text-gray-500 mt-2">{t("bookingLookupError")}</p>
        <Link href="/search" className="mt-6 btn-ui btn-ui-primary rounded-2xl px-6 py-3">
          {t("searchPlaceholder")}
        </Link>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <h1 className="text-xl font-black text-gray-900">{t("cancelSuccess")}</h1>
        {cancelFullRefund && (
          <p className="text-sm text-gray-500 mt-2">{t("cancelSuccessRefund")}</p>
        )}
        <Link href="/search" className="mt-6 btn-ui btn-ui-primary rounded-2xl px-6 py-3">
          {t("searchPlaceholder")}
        </Link>
      </div>
    );
  }

  const canCancel = ["PENDING", "APPROVED", "PAID", "WAITING_APPROVAL"].includes(booking.status);
  const totalBags = booking.bagCountS + booking.bagCountM + booking.bagCountXl;
  const checkIn = new Date(booking.checkInTime);
  const checkOut = new Date(booking.checkOutTime);
  const hours = Math.round((checkOut.getTime() - checkIn.getTime()) / 3600000 * 10) / 10;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6">
            <h1 className="text-lg font-black text-gray-900 mb-4">
              {t("manageBookingTitle")}
            </h1>

            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                <MapPin size={24} className="text-orange-600" />
              </div>
              <div>
                <p className="font-black text-gray-900">{booking.shopName}</p>
                <p className="text-xs text-gray-500">{booking.shopAddress}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase">{t("status")}</span>
                <span className="text-xs font-black px-2 py-1 rounded-lg bg-orange-50 text-orange-600">
                  {(() => {
                    /*
                      Ham `booking.status` ("WAITING_APPROVAL" gibi) yazdirmak
                      hesapsiz erisen -- coğu zaman tam bu ekrana kod cevirilerini
                      bilmedigi icin dusen -- misafire cevrilmemis bir motor
                      degeri gosteriyordu. `BookingsClient.tsx` ayni durumu
                      zaten `guestBookingStatusMessageKey` ile cozuyor.
                    */
                    const k = guestBookingStatusMessageKey(booking.status);
                    return k ? t(k as never) : booking.status;
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1">
                  <Calendar size={12} /> {t("checkIn")}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {formatDateTimeInZone(checkIn, { locale: dateLocale, timeZone: booking.shopTimeZone, dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1">
                  <Calendar size={12} /> {t("checkOut")}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {formatDateTimeInZone(checkOut, { locale: dateLocale, timeZone: booking.shopTimeZone, dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1">
                  <Clock size={12} /> {t("duration")}
                </span>
                <span className="text-sm font-bold text-gray-900">{hours}h</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1">
                  <Luggage size={12} /> {t("bags")}
                </span>
                <span className="text-sm font-bold text-gray-900">{totalBags}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400 font-bold uppercase">{t("total")}</span>
                <Money amount={Number(booking.totalPrice)} className="text-lg font-black text-gray-900" />
              </div>
            </div>

            {canCancel && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={cancelling}
                className="mt-6 w-full py-4 rounded-2xl bg-red-500 text-white id-eyebrow text-sm disabled:opacity-50 hover:bg-red-600 transition-colors"
              >
                {cancelling ? "..." : t("cancelBooking")}
              </button>
            )}

            {(() => {
              const pending = booking.pendingBagRevision;
              if (
                !pending ||
                typeof pending.extraAmount !== "number" ||
                pending.extraAmount <= 0 ||
                typeof pending.bagCountS !== "number" ||
                typeof pending.bagCountM !== "number" ||
                typeof pending.bagCountXl !== "number" ||
                typeof pending.newTotal !== "number" ||
                typeof pending.previousTotal !== "number"
              ) {
                return null;
              }
              return (
                <div className="mt-6">
                  <BagRevisionApproval
                    bookingId={booking.id}
                    revision={pending as PendingBagRevisionInfo}
                    onDecided={refetchBooking}
                    approveAction={() => decideBagRevision("approve")}
                    rejectAction={() => decideBagRevision("reject")}
                  />
                </div>
              );
            })()}

            <ConfirmDialog
              open={confirmOpen}
              title={t("cancelDialogTitle")}
              message={t("confirmCancel")}
              confirmLabel={t("cancelConfirmAction")}
              cancelLabel={t("modifyCancel")}
              onCancel={() => setConfirmOpen(false)}
              onConfirm={handleCancel}
            />
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-400">
            {t("manageBookingFooter")}{" "}
            <Link href="/search" className="text-orange-600 font-bold underline">
              {t("searchPlaceholder")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

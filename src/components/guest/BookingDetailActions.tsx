"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { XCircle, Calendar as CalendarIcon, Phone, ExternalLink } from "lucide-react";
import { cancelBookingAction } from "@/actions/booking";
import { toast } from "sonner";

type Props = {
  bookingId: string;
  canCancel: boolean;
  checkInIso: string;
  checkOutIso: string;
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
};

export default function BookingDetailActions({
  bookingId,
  canCancel,
  checkInIso,
  checkOutIso,
  shopName,
  shopAddress,
  shopPhone,
}: Props) {
  const t = useTranslations("Guest");
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!confirm(t("cancelBookingConfirm"))) return;
    setCancelling(true);
    const res = await cancelBookingAction(bookingId);
    setCancelling(false);
    if (res.success) {
      toast.success(t("bookingCancelled"));
      window.location.reload();
    } else {
      toast.error(typeof res.error === "string" ? res.error : t("cancelFailed"));
    }
  };

  const googleCalUrl = () => {
    const start = new Date(checkInIso);
    const end = new Date(checkOutIso);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `${t("luggageStorageAt")} ${shopName}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `${t("bookingDetailCalendarDesc")}: ${shopName}${shopAddress ? `, ${shopAddress}` : ""}`,
      location: shopAddress ?? "",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {canCancel && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {cancelling ? (
            <div className="w-4 h-4 border-2 border-red-300 border-t-red-700 rounded-full animate-spin" />
          ) : (
            <XCircle size={16} />
          )}
          {t("cancelBooking")}
        </button>
      )}

      <a
        href={googleCalUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-700 text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
      >
        <CalendarIcon size={16} />
        {t("addToCalendar")}
      </a>

      {shopPhone && (
        <a
          href={`tel:${shopPhone}`}
          className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-700 text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
        >
          <Phone size={16} />
          {shopPhone}
        </a>
      )}

      {shopAddress && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shopAddress)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-700 text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
        >
          <ExternalLink size={16} />
          {t("getDirections")}
        </a>
      )}
    </div>
  );
}

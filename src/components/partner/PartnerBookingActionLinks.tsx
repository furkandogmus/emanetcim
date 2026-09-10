"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

type BookingStatus =
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "PENDING"
  | "PAID"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED";

export default function PartnerBookingActionLinks({
  status,
  bookingId,
}: {
  status: BookingStatus | string;
  bookingId: string;
}) {
  const t = useTranslations("Partner");

  if (status === "WAITING_APPROVAL") {
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-2xl bg-orange-50 px-3 py-3 text-center text-xs font-bold text-orange-800">
          {t("partnerBookingAwaitingApprovalHint")}
        </p>
        <Link
          href="/partner"
          className="w-full rounded-2xl bg-orange-600 px-4 py-3 text-center text-xs font-black text-white transition-colors hover:bg-orange-700"
        >
          {t("partnerBookingsOpenPanel")}
        </Link>
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-2xl bg-amber-50 px-3 py-3 text-center text-xs font-bold text-amber-800">
          {t("partnerBookingAwaitGuestPaymentHint")}
        </p>
        <Link
          href="/partner"
          className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-center text-xs font-black text-amber-900 transition-colors hover:bg-amber-50"
        >
          {t("partnerBookingsOpenPanel")}
        </Link>
      </div>
    );
  }

  if (status === "PAID" || status === "APPROVED") {
    return (
      <div className="flex flex-col gap-2">
        {status === "APPROVED" && (
          <p className="rounded-2xl bg-amber-50 px-3 py-3 text-center text-xs font-bold text-amber-800">
            {t("partnerBookingApprovedCheckInHint")}
          </p>
        )}
        <Link
          href={`/partner?booking=${bookingId}`}
          className="block w-full rounded-2xl bg-orange-600 px-4 py-3 text-center text-xs font-black text-white transition-colors hover:bg-orange-700"
        >
          {t("customerArrivedCheckIn")}
        </Link>
      </div>
    );
  }

  if (status === "CHECKED_IN") {
    /*
      `.btn-ui-primary` EKLENDI (2026-09-10). Bu buton, PartnerHistoryTab'daki
      ayni islemin (`deliveryCheckoutShort`) BIREBIR ayni sinifi (`btn-ui
      btn-ui-lg btn-ui-primary bg-gray-900 hover:bg-black`) tasiyan karsiligiyla
      ayni islemi yapiyor -- ama burada `.btn-ui-primary` HIC yoktu, yani
      `bg-gray-900` hicbir seyle yarismadan dogrudan uyguluyordu ve buton
      panelin turuncu birincil-eylem renginden farkli, duz siyah goruunuyordu.
    */
    return (
      <Link
        href={`/partner?checkoutBooking=${bookingId}`}
        className="btn-ui btn-ui-lg btn-ui-primary block w-full rounded-2xl bg-gray-900 hover:bg-black"
      >
        {t("handOverCheckout")}
      </Link>
    );
  }

  return null;
}

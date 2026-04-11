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
          className="w-full rounded-2xl bg-orange-600 py-4 text-center text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-orange-700"
        >
          {t("partnerBookingsOpenPanel")}
        </Link>
      </div>
    );
  }

  if (status === "PENDING" || status === "APPROVED") {
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-2xl bg-amber-50 px-3 py-3 text-center text-xs font-bold text-amber-800">
          {t("partnerBookingAwaitGuestPaymentHint")}
        </p>
        <Link
          href="/partner"
          className="w-full rounded-2xl border border-amber-200 bg-white py-4 text-center text-xs font-black uppercase tracking-widest text-amber-900 transition-colors hover:bg-amber-50"
        >
          {t("partnerBookingsOpenPanel")}
        </Link>
      </div>
    );
  }

  if (status === "PAID") {
    return (
      <Link
        href={`/partner?booking=${bookingId}`}
        className="block w-full rounded-2xl bg-orange-600 py-4 text-center text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-orange-700"
      >
        {t("customerArrivedCheckIn")}
      </Link>
    );
  }

  if (status === "CHECKED_IN") {
    return (
      <Link
        href={`/partner?checkoutBooking=${bookingId}`}
        className="block w-full rounded-2xl bg-gray-900 py-4 text-center text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-black"
      >
        {t("handOverCheckout")}
      </Link>
    );
  }

  return null;
}

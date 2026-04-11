"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import BookingModifyModal, {
  canGuestModifyBooking,
  type BookingModifyModalBooking,
} from "@/components/guest/BookingModifyModal";
import type { PricingRules } from "@/lib/pricing-rules";

export default function BookingDetailModifySection({
  booking,
  pricingRules,
}: {
  booking: BookingModifyModalBooking;
  pricingRules: PricingRules;
}) {
  const t = useTranslations("Guest");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!canGuestModifyBooking(booking.status)) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest border-2 border-gray-200 text-gray-800 hover:bg-gray-50 transition-colors"
      >
        {t("modifyBooking")}
      </button>
      {open ? (
        <BookingModifyModal
          booking={booking}
          pricingRules={pricingRules}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            toast.success(t("modifySuccess"));
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

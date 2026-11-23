"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { useActionErrorText } from "@/lib/use-action-error";
import { holdLateBookingAction } from "@/actions/booking-closure";

type Props = {
  bookingId: string;
  /** Otomatik kapanis ani, dukkan diliminde bicimlenmis. */
  closeAtLabel: string;
  /** Bekletme suruyorsa bittigi an; yoksa `null`. */
  holdUntilLabel: string | null;
  /** Sunucuda hesaplandi (`decideLateHold`): alma saatine dayandiysa `false`. */
  canHold: boolean;
};

/** Esnaf: gec kalan misafir icin otomatik kapanis saati ve "Misafiri bekle". */
export default function PartnerLateHoldAction({ bookingId, closeAtLabel, holdUntilLabel, canHold }: Props) {
  const t = useTranslations("Partner");
  const errorText = useActionErrorText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const hold = async () => {
    setBusy(true);
    try {
      const res = await holdLateBookingAction(bookingId);
      if (res.success) {
        toast.success(t("partnerLateHoldDone"));
        router.refresh();
      } else {
        toast.error(errorText(res.error));
      }
    } catch {
      toast.error(errorText(undefined));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-live="polite">
      <p className="text-sm font-bold text-amber-900">{t("partnerLateTitle")}</p>
      <p className="text-sm font-bold text-amber-900">{t("partnerLateCloseAt", { time: closeAtLabel })}</p>
      {holdUntilLabel ? (
        <p className="text-xs text-amber-900">{t("partnerLateHoldActive", { time: holdUntilLabel })}</p>
      ) : null}
      <p className="text-xs text-amber-800">{t("partnerLateHint")}</p>
      <button
        type="button"
        disabled={busy || !canHold}
        onClick={() => void hold()}
        className="w-full rounded-2xl border border-amber-300 bg-white px-4 py-3 text-center text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
      >
        {t("partnerLateHold")}
      </button>
      {!canHold ? <p className="text-center text-[11px] text-amber-800">{t("partnerLateHoldLimitReached")}</p> : null}
    </section>
  );
}

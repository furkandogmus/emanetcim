"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useActionErrorText } from "@/lib/use-action-error";
import { PARTNER_CANCEL_REASONS, type PartnerCancelReason } from "@/lib/booking-closure";
import { markNoShowAction, partnerCancelBookingAction } from "@/actions/booking-closure";

type Props = {
  bookingId: string;
  /** Sunucuda hesaplandi: hidrasyonda istemci saatiyle ayrismasin. */
  noShowReady: boolean;
  /** "Misafir gelmedi"nin acilacagi an, dukkan diliminde bicimlenmis. */
  noShowAvailableLabel: string;
  /** Personelde `false`: iptal `manage` islemi, yalniz "gelmedi" kalir. */
  canCancel?: boolean;
};

/** Esnaf: valiz birakilmadan once "Rezervasyonu iptal et" ve "Misafir gelmedi". */
export default function PartnerBookingClosureActions({ bookingId, noShowReady, noShowAvailableLabel, canCancel = true }: Props) {
  const t = useTranslations("Partner");
  const errorText = useActionErrorText();
  const router = useRouter();
  const [mode, setMode] = useState<"cancel" | "noShow" | null>(null);
  const [reason, setReason] = useState<PartnerCancelReason>("guest_request");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const current = mode;
    setMode(null);
    setBusy(true);
    try {
      const action = current === "cancel" ? () => partnerCancelBookingAction(bookingId, reason, note) : () => markNoShowAction(bookingId);
      const res = await action();
      if (res.success) {
        toast.success(current === "cancel" ? t("partnerCancelDone") : t("partnerNoShowDone"));
        router.refresh();
      } else {
        toast.error(errorText(res.error));
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : undefined;
      toast.error(errorText(raw));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy || !noShowReady}
        onClick={() => setMode("noShow")}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-center text-xs font-black text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        {t("partnerNoShow")}
      </button>
      {!noShowReady && (
        <p className="text-center text-[11px] text-gray-500">
          {t("partnerNoShowAvailableAt", { time: noShowAvailableLabel })}
        </p>
      )}
      {canCancel && (
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setReason("guest_request");
          setNote("");
          setMode("cancel");
        }}
        className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-xs font-black text-red-700 transition-colors hover:bg-red-100"
      >
        {t("partnerCancelBooking")}
      </button>
      )}

      <ConfirmDialog
        open={mode !== null}
        title={mode === "cancel" ? t("partnerCancelBooking") : t("partnerNoShow")}
        message={mode === "cancel" ? t("partnerCancelConfirm") : t("partnerNoShowConfirm")}
        confirmLabel={mode === "cancel" ? t("partnerCancelBooking") : t("partnerNoShow")}
        cancelLabel={t("partnerCloseKeep")}
        onCancel={() => setMode(null)}
        onConfirm={() => void submit()}
        confirmDisabled={mode === "cancel" && reason === "other" && note.trim().length === 0}
      >
        {mode === "cancel" ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-gray-600">{t("partnerCancelReasonLabel")}</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as PartnerCancelReason)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900"
              >
                {PARTNER_CANCEL_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`partnerCancelReason_${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-gray-600">
                {reason === "other" ? t("partnerCancelNoteRequiredLabel") : t("partnerCancelNoteLabel")}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900"
              />
            </label>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

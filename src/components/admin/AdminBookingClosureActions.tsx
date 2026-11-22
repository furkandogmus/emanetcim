"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useActionErrorText } from "@/lib/use-action-error";
import { ADMIN_NOTE_MIN_LENGTH, isNotDroppedStatus } from "@/lib/booking-closure";
import { adminCancelBookingAction, adminForceCheckOutAction } from "@/actions/booking-closure";

type Mode = "cancel" | "checkout" | null;

/** Yonetici: check-in oncesi "Iptal et", CHECKED_IN icin "Zorla teslim et". Aciklama zorunlu. */
export default function AdminBookingClosureActions({ bookingId, status }: { bookingId: string; status: string }) {
  const t = useTranslations("Admin");
  const errorText = useActionErrorText();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const canCancel = isNotDroppedStatus(status);
  const canForce = status === "CHECKED_IN";
  if (!canCancel && !canForce) return null;

  const open = (m: Mode) => {
    setNote("");
    setMode(m);
  };

  const submit = async () => {
    const current = mode;
    setMode(null);
    setBusy(true);
    try {
      const action = current === "cancel" ? () => adminCancelBookingAction(bookingId, note) : () => adminForceCheckOutAction(bookingId, note);
      const res = await action();
      if (res.success) {
        toast.success(current === "cancel" ? t("bookingCloseCancelDone") : t("bookingCloseForceDone"));
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
    <div className="id-surface p-6 mb-6 flex flex-wrap items-center gap-3">
      <p className="text-xs id-eyebrow text-gray-500 mr-auto">{t("bookingCloseSectionTitle")}</p>
      {canCancel && (
        <button
          type="button"
          disabled={busy}
          onClick={() => open("cancel")}
          className="btn-ui btn-ui-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        >
          {t("bookingCloseCancel")}
        </button>
      )}
      {canForce && (
        <button
          type="button"
          disabled={busy}
          onClick={() => open("checkout")}
          className="btn-ui btn-ui-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
        >
          {t("bookingCloseForceCheckout")}
        </button>
      )}

      <ConfirmDialog
        open={mode !== null}
        title={mode === "cancel" ? t("bookingCloseCancel") : t("bookingCloseForceCheckout")}
        message={mode === "cancel" ? t("bookingCloseCancelConfirm") : t("bookingCloseForceCheckoutConfirm")}
        confirmLabel={mode === "cancel" ? t("bookingCloseCancel") : t("bookingCloseForceCheckout")}
        cancelLabel={t("bookingCloseKeep")}
        onCancel={() => setMode(null)}
        onConfirm={() => void submit()}
        confirmDisabled={note.trim().length < ADMIN_NOTE_MIN_LENGTH}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-gray-600">{t("bookingCloseNoteLabel")}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-orange-500/40"
          />
          <span className="text-[11px] text-gray-400">{t("bookingCloseNoteHint", { min: ADMIN_NOTE_MIN_LENGTH })}</span>
        </label>
      </ConfirmDialog>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, RotateCcw, XCircle } from "lucide-react";
import { cancelBookingAction } from "@/actions/booking";
import { useActionErrorText } from "@/lib/use-action-error";
import ConfirmDialog from "@/components/common/ConfirmDialog";

/**
 * Suresi dolmus (gelinmemis) rezervasyon: mobil `ExpiredBookingActions` ile ayni.
 * "Yeniden rezervasyon" birincil; "Kapat" yalniz valiz birakilmamissa ve misafir iptal
 * yolunu (`cancelBookingAction`) kullanir, sunucu birakilmis valizde reddeder.
 */
export default function ExpiredBookingPanel({
  bookingId,
  rebookHref,
  canClose,
}: {
  bookingId: string;
  rebookHref: string;
  canClose: boolean;
}) {
  const t = useTranslations("GuestBookingParity");
  const errorText = useActionErrorText();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const close = async () => {
    setConfirmOpen(false);
    setClosing(true);
    try {
      const res = await cancelBookingAction(bookingId);
      if (res.success) {
        toast.success(t("closeExpiredDone"));
        window.location.reload();
      } else {
        toast.error(errorText(res.error, t("closeExpiredFailed")));
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : undefined;
      toast.error(errorText(raw, t("closeExpiredFailed")));
    } finally {
      setClosing(false);
    }
  };

  return (
    <section
      data-testid="expired-booking-panel"
      className="flex flex-col gap-3 rounded-4xl border border-amber-200 bg-amber-50 p-6"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
        <div>
          <h2 className="font-bold text-gray-900">{t("expiredTitle")}</h2>
          <p className="text-sm text-gray-700">{t("expiredBody")}</p>
        </div>
      </div>
      <a
        href={rebookHref}
        className="btn-ui btn-ui-lg btn-ui-primary flex w-full items-center justify-center gap-2"
      >
        <RotateCcw size={16} aria-hidden />
        {t("rebook")}
      </a>
      {canClose && (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={closing}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-3.5 text-xs id-eyebrow text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <XCircle size={16} aria-hidden />
          {t("closeExpired")}
        </button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={t("closeExpiredTitle")}
        message={t("closeExpiredBody")}
        confirmLabel={t("closeExpiredConfirm")}
        cancelLabel={t("closeExpiredKeep")}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={close}
      />
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { blockReviewAuthorAction, reportReviewAction } from "@/actions/review-report";

/** `ReviewService.REVIEW_REPORT_REASONS` ile ayni sira; istemci servisi ithal etmez. */
const REASONS = ["SPAM", "OFFENSIVE", "HARASSMENT", "FALSE_INFO", "PERSONAL_INFO", "OTHER"] as const;
type Reason = (typeof REASONS)[number];

/**
 * Yorum satirindaki "Bildir" ve "Bu kullanicinin yorumlarini gizle" (App Review 1.2).
 * Oturumsuz goruntuleyen giris sayfasina gider.
 */
export default function ReviewActions({
  reviewId,
  signedIn,
  onHidden,
}: {
  reviewId: string;
  signedIn: boolean;
  onHidden: (reviewId: string) => void;
}) {
  const t = useTranslations("Review");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const router = useRouter();
  const [open, setOpen] = useState<"report" | "block" | null>(null);
  const [reason, setReason] = useState<Reason>("OFFENSIVE");
  const [note, setNote] = useState("");
  const [busy, startTransition] = useTransition();

  const errorText = (key: string) => tErrors(key.replace(/^Errors\./, "") as never);

  if (!signedIn) {
    return (
      <Link href="/login" className="mt-2 inline-block text-[11px] font-bold text-gray-400 underline">
        {t("reportSignIn")}
      </Link>
    );
  }

  const submitReport = () => {
    setOpen(null);
    startTransition(async () => {
      try {
        const r = await reportReviewAction({ reviewId, reason, note: note.trim() || undefined });
        if (!r.success) {
          toast.error(errorText(r.error));
          return;
        }
        toast.success(t("reportThanks"));
      } catch {
        toast.error(tErrors("generic"));
      }
    });
  };

  const submitBlock = () => {
    setOpen(null);
    startTransition(async () => {
      try {
        const r = await blockReviewAuthorAction(reviewId);
        if (!r.success) {
          toast.error(errorText(r.error));
          return;
        }
        onHidden(reviewId);
        toast.success(t("blockDone"));
        router.refresh();
      } catch {
        toast.error(tErrors("generic"));
      }
    });
  };

  return (
    <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-gray-400">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setNote("");
          setOpen("report");
        }}
        className="underline hover:text-gray-700 disabled:opacity-50"
      >
        {t("report")}
      </button>
      <button type="button" disabled={busy} onClick={() => setOpen("block")} className="underline hover:text-gray-700 disabled:opacity-50">
        {t("blockAuthor")}
      </button>

      <ConfirmDialog
        open={open === "report"}
        title={t("reportTitle")}
        message={t("reportBody")}
        confirmLabel={t("reportSend")}
        cancelLabel={tCommon("cancel")}
        onConfirm={submitReport}
        onCancel={() => setOpen(null)}
      >
        <fieldset className="mt-3 flex flex-col gap-2 text-sm font-normal text-gray-700">
          <legend className="mb-1 font-bold">{t("reportReasonLabel")}</legend>
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input type="radio" name={`report-${reviewId}`} checked={reason === r} onChange={() => setReason(r)} />
              {t(`reportReason_${r}` as never)}
            </label>
          ))}
          <label className="mt-2 block font-bold">
            {t("reportNoteLabel")}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 font-normal"
            />
          </label>
        </fieldset>
      </ConfirmDialog>

      <ConfirmDialog
        open={open === "block"}
        title={t("blockTitle")}
        message={t("blockBody")}
        confirmLabel={t("blockConfirm")}
        cancelLabel={tCommon("cancel")}
        onConfirm={submitBlock}
        onCancel={() => setOpen(null)}
      />
    </div>
  );
}

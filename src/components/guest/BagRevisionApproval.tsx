"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import Money from "@/components/common/Money";
import { useActionErrorText } from "@/lib/use-action-error";
import { approveBagRevisionAction, rejectBagRevisionAction } from "@/actions/booking";

export type PendingBagRevisionInfo = {
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  extraAmount: number;
  previousTotal: number;
  newTotal: number;
};

/**
 * DEFECT_BACKLOG D5 (2026-09-12): check-in sonrası fiyat artıran bir valiz
 * düzeltmesi artık esnaftan tek başına geçmiyor -- burası misafirin onay/red
 * yüzeyi. Hesapsız (token'la giren) misafir için `ManageBookingClient` aynı
 * bileşeni token tabanlı uçlarla kullanıyor.
 */
export default function BagRevisionApproval({
  bookingId,
  revision,
  onDecided,
  approveAction,
  rejectAction,
}: {
  bookingId: string;
  revision: PendingBagRevisionInfo;
  /** Karardan sonra çağrılır — sayfa listesini/booking'i tazelemek için. */
  onDecided?: () => void;
  /** Varsayılan: hesaplı misafir server action'ları. Token'lı misafir kendi fetch'ini geçirir. */
  approveAction?: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
  rejectAction?: (bookingId: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const t = useTranslations("Guest");
  const errorText = useActionErrorText();
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);

  const totalBags = revision.bagCountS + revision.bagCountM + revision.bagCountXl;

  const handle = async (action: "approve" | "reject") => {
    setSubmitting(action);
    try {
      const fn =
        action === "approve"
          ? approveAction ?? approveBagRevisionAction
          : rejectAction ?? rejectBagRevisionAction;
      const res = await fn(bookingId);
      if (res.success) {
        toast.success(action === "approve" ? t("bagRevisionApproved") : t("bagRevisionRejected"));
        onDecided?.();
        router.refresh();
      } else {
        toast.error(errorText(res.error, t("bagRevisionActionFailed")));
      }
    } catch {
      toast.error(t("bagRevisionActionFailed"));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-4xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <AlertTriangle size={20} aria-hidden />
        </div>
        <div>
          <p className="id-eyebrow text-amber-800/80">{t("bagRevisionPendingTitle")}</p>
          <p className="mt-1 text-sm font-medium text-gray-700">
            {t("bagRevisionPendingBody", { count: totalBags })}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
        <span className="text-gray-500">{t("bagRevisionNewTotal")}</span>
        <Money amount={revision.newTotal} className="id-display text-gray-900" />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => handle("reject")}
          className="btn-ui btn-ui-md btn-ui-ghost flex-1 rounded-2xl disabled:opacity-50"
        >
          {submitting === "reject" ? "…" : t("bagRevisionReject")}
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => handle("approve")}
          className="btn-ui btn-ui-md btn-ui-primary flex-1 rounded-2xl disabled:opacity-50"
        >
          {submitting === "approve" ? "…" : t("bagRevisionApprove")}
        </button>
      </div>
    </div>
  );
}

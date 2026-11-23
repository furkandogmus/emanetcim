"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { cancelAccountDeletionAction, completeAccountDeletionAction } from "@/actions/account-deletion-admin";
import { actionErrorKey } from "@/lib/action-error";
import { formatInstant } from "@/lib/format-datetime";

export type AccountDeletionRowVm = {
  id: string;
  userId: string;
  role: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  note: string | null;
  requestedAtIso: string;
  dueAtIso: string;
  name: string | null;
  email: string | null;
  activeBookings: number;
  pendingPayouts: number;
};

type Pending = { row: AccountDeletionRowVm; action: "complete" | "cancel" } | null;

/** Esnaf/yonetici hesap silme talepleri. Tamamlama `AccountPrivacyService.completeDeletionRequest`. */
export default function AdminAccountDeletionsClient({
  rows,
  currentAdminId,
}: {
  rows: AccountDeletionRowVm[];
  currentAdminId: string;
}) {
  const t = useTranslations("AdminAccountDeletions");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");

  const day = (iso: string) => formatInstant(iso, locale, { dateStyle: "medium" });
  const errorText = (key: string) => tErrors(key.replace(/^Errors\./, "") as never);

  const run = () => {
    if (!pending) return;
    const { row, action } = pending;
    setPending(null);
    startTransition(async () => {
      try {
        let r;
        if (action === "complete") {
          const done = await completeAccountDeletionAction(row.id);
          r = done;
        } else {
          const done = await cancelAccountDeletionAction(row.id, reason);
          r = done;
        }
        if (!r.success) {
          toast.error(errorText(r.error));
          return;
        }
        toast.success(t(action === "complete" ? "completed" : "cancelled"));
        router.refresh();
      } catch (e) {
        toast.error(tErrors(actionErrorKey(e) as never));
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
      <header className="mb-10">
        <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-gray-500 hover:text-gray-900">
          <ArrowLeft size={16} />
          <span className="text-xs id-eyebrow">{t("back")}</span>
        </Link>
        <h1 className="text-4xl id-display tracking-tighter text-gray-900">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-600">{t("intro")}</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white px-8 py-16 text-center text-sm font-bold text-gray-400">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => {
            const blocked = row.activeBookings > 0 || row.pendingPayouts > 0;
            const isSelf = row.userId === currentAdminId;
            return (
              <li key={row.id} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-base font-bold text-gray-900">{row.name || row.email || row.userId}</p>
                  <span className="text-xs id-eyebrow text-gray-500">
                    {t(`role_${row.role}` as never)} · {t(`status_${row.status}` as never)}
                  </span>
                </div>
                {row.email ? <p className="text-sm text-gray-600">{row.email}</p> : null}
                <p className="mt-2 text-sm text-gray-600">
                  {t("dates", { requested: day(row.requestedAtIso), due: day(row.dueAtIso) })}
                </p>
                {row.note ? <p className="mt-1 text-sm text-gray-500">{row.note}</p> : null}
                {row.status === "PENDING" ? (
                  <>
                    {blocked ? (
                      <p className="mt-2 text-sm font-bold text-amber-700">
                        {t("blockers", { bookings: row.activeBookings, payouts: row.pendingPayouts })}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || blocked || isSelf}
                        onClick={() => setPending({ row, action: "complete" })}
                        className="rounded-full bg-red-600 px-5 py-2.5 text-xs id-eyebrow text-white hover:bg-red-700 disabled:opacity-40"
                      >
                        {t("complete")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setReason("");
                          setPending({ row, action: "cancel" });
                        }}
                        className="rounded-full border border-gray-200 px-5 py-2.5 text-xs id-eyebrow text-gray-900 hover:bg-gray-50 disabled:opacity-40"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={t(pending?.action === "cancel" ? "cancelTitle" : "completeTitle")}
        message={t(pending?.action === "cancel" ? "cancelBody" : "completeBody")}
        confirmLabel={t(pending?.action === "cancel" ? "cancel" : "complete")}
        cancelLabel={tCommon("cancel")}
        onConfirm={run}
        onCancel={() => setPending(null)}
        confirmDisabled={pending?.action === "cancel" && reason.trim().length < 5}
      >
        {pending?.action === "cancel" ? (
          <label className="mt-3 block text-sm font-bold text-gray-700">
            {t("reasonLabel")}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm font-normal"
            />
          </label>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

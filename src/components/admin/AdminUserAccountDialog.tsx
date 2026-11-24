"use client";

import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, FlaskConical, ScrollText, UserX, X } from "lucide-react";
import type { Role } from "@prisma/client";
import { Link } from "@/i18n/routing";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";
import { actionErrorKey } from "@/lib/action-error";
import { adminAnonymizeUserAction, adminSetReviewSandboxAction } from "@/actions/admin-user-tools";
import { startImpersonationAction } from "@/actions/admin-impersonation";

export type AccountToolsTarget = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  isBanned: boolean;
  reviewSandbox: boolean;
  isAnonymized: boolean;
};

/** Mobil `ERASURE_REASON_MIN` ile ayni; sunucu da ayni siniri uygular. */
const ERASURE_REASON_MIN = 5;

type Step = "panel" | "sandbox" | "impersonate" | "erase";

/**
 * Kullanici detayindaki hesap araclari (mobil `admin/user/[id]` karsiligi): kisiye gore
 * denetim kaydi, inceleme (App Review) hesabi, olarak goruntule ve KVKK silmesi.
 */
export default function AdminUserAccountDialog({
  target,
  currentAdminId,
  onClose,
  onSandboxChanged,
}: {
  target: AccountToolsTarget | null;
  currentAdminId: string;
  onClose: () => void;
  onSandboxChanged: (userId: string, reviewSandbox: boolean) => void;
}) {
  const t = useTranslations("AdminUserAccount");
  const tImp = useTranslations("AdminImpersonation");
  const tCommon = useTranslations("Common");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const [step, setStep] = useState<Step>("panel");
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [busy, startTransition] = useTransition();

  const close = () => {
    setStep("panel");
    setConfirm("");
    setReason("");
    onClose();
  };
  const modalRef = useRef<HTMLDivElement>(null);
  useModalBehavior({ open: target !== null && step === "panel", onClose: close, ref: modalRef });

  if (!target) return null;

  const label = target.isAnonymized ? t("anonymizedLabel") : target.name || target.email || target.phone || "-";
  const isAdmin = target.role === "ADMIN";
  const canErase = target.role === "GUEST" && !target.isAnonymized && target.id !== currentAdminId;
  const canImpersonate = !isAdmin && !target.isBanned && !target.isAnonymized;

  const errorText = (code: string, ns: "user" | "imp") => {
    if (code.startsWith("Errors.")) return tErrors(actionErrorKey(new Error(code)) as never);
    return ns === "imp" ? tImp(`error_${code}` as never) : t(`error_${code}` as never);
  };

  const toggleSandbox = (on: boolean) =>
    startTransition(async () => {
      try {
        const r = await adminSetReviewSandboxAction({ userId: target.id, reviewSandbox: on });
        if (!r.ok) {
          toast.error(errorText(r.error, "user"));
          return;
        }
        onSandboxChanged(target.id, on);
        toast.success(on ? t("reviewSandboxOnDone") : t("reviewSandboxOffDone"));
        setStep("panel");
      } catch (e) {
        toast.error(tErrors(actionErrorKey(e) as never));
      }
    });

  const impersonate = () =>
    startTransition(async () => {
      try {
        const r = await startImpersonationAction(target.id);
        if (!r.ok) {
          toast.error(errorText(r.error, "imp"));
          setStep("panel");
          return;
        }
        // Tam yukleme: istemcideki oturum onbellegi hedefin oturumuyla yenilensin.
        window.location.assign(`/${locale}`);
      } catch (e) {
        toast.error(tErrors(actionErrorKey(e) as never));
      }
    });

  const erase = () =>
    startTransition(async () => {
      try {
        const r = await adminAnonymizeUserAction({ userId: target.id, confirm: confirm.trim(), reason: reason.trim() });
        if (!r.ok) {
          toast.error(errorText(r.error, "user"));
          return;
        }
        toast.success(t("eraseDone"));
        window.location.reload();
      } catch (e) {
        toast.error(tErrors(actionErrorKey(e) as never));
      }
    });

  if (step === "sandbox") {
    return (
      <ConfirmDialog
        open
        title={t("reviewSandboxConfirmTitle", { name: label })}
        message={t("reviewSandboxConfirmBody")}
        confirmLabel={t("reviewSandboxConfirm")}
        cancelLabel={tCommon("cancel")}
        onConfirm={() => toggleSandbox(true)}
        onCancel={() => setStep("panel")}
        confirmDisabled={busy}
      />
    );
  }
  if (step === "impersonate") {
    return (
      <ConfirmDialog
        open
        title={tImp("confirmTitle", { name: label })}
        message={tImp("confirmBody")}
        confirmLabel={tImp("confirmStart")}
        cancelLabel={tCommon("cancel")}
        onConfirm={impersonate}
        onCancel={() => setStep("panel")}
        confirmDisabled={busy}
      />
    );
  }
  if (step === "erase") {
    return (
      <ConfirmDialog
        open
        title={t("eraseTitle")}
        message={t("eraseBody")}
        confirmLabel={t("eraseSubmit")}
        cancelLabel={tCommon("cancel")}
        onConfirm={erase}
        onCancel={() => setStep("panel")}
        confirmDisabled={busy || confirm.trim().length === 0 || reason.trim().length < ERASURE_REASON_MIN}
      >
        <label className="mt-3 block text-sm font-bold text-gray-700">
          {t("eraseConfirmLabel")}
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t("eraseConfirmPlaceholder")}
            aria-label={t("eraseConfirmLabel")}
            autoComplete="off"
            className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm font-normal"
          />
        </label>
        <label className="mt-3 block text-sm font-bold text-gray-700">
          {t("eraseReasonLabel")}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("eraseReasonPlaceholder")}
            aria-label={t("eraseReasonLabel")}
            maxLength={500}
            rows={3}
            className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm font-normal"
          />
          <span className="mt-1 block text-xs font-normal text-gray-500">
            {t("eraseReasonHint", { min: ERASURE_REASON_MIN })}
          </span>
        </label>
      </ConfirmDialog>
    );
  }

  const row = "flex w-full items-center gap-3 rounded-2xl border border-gray-100 p-4 text-left text-sm hover:bg-gray-50";

  return (
    <div ref={modalRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-user-account-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="admin-user-account-title" className="truncate text-lg id-display text-gray-900">
              {label}
            </h2>
            <p className="truncate text-xs text-gray-500">
              {[target.email, target.phone, target.role].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={tCommon("close")}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {target.isAnonymized ? (
          <p className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">{t("anonymized")}</p>
        ) : null}

        <div className="flex flex-col gap-3">
          <Link href={`/admin/audit-log?userId=${target.id}`} className={row} onClick={close}>
            <ScrollText size={18} className="text-gray-400" />
            <span>
              <span className="block font-bold text-gray-900">{t("auditLink")}</span>
              <span className="block text-xs text-gray-500">{t("auditLinkHint")}</span>
            </span>
          </Link>

          {!isAdmin && !target.isAnonymized ? (
            <label className={`${row} cursor-pointer`}>
              <FlaskConical size={18} className="text-gray-400" />
              <span className="flex-1">
                <span className="block font-bold text-gray-900">{t("reviewSandbox")}</span>
                <span className="block text-xs text-gray-500">{t("reviewSandboxHint")}</span>
              </span>
              <input
                type="checkbox"
                aria-label={t("reviewSandbox")}
                checked={target.reviewSandbox}
                disabled={busy}
                onChange={(e) => (e.target.checked ? setStep("sandbox") : toggleSandbox(false))}
                className="h-5 w-5"
              />
            </label>
          ) : null}

          {canImpersonate ? (
            <button type="button" className={row} disabled={busy} onClick={() => setStep("impersonate")}>
              <Eye size={18} className="text-gray-400" />
              <span>
                <span className="block font-bold text-gray-900">{tImp("start")}</span>
                <span className="block text-xs text-gray-500">{tImp("startHint")}</span>
              </span>
            </button>
          ) : null}

          {canErase ? (
            <button
              type="button"
              className={`${row} border-red-100 hover:bg-red-50`}
              disabled={busy}
              onClick={() => setStep("erase")}
            >
              <UserX size={18} className="text-red-500" />
              <span>
                <span className="block font-bold text-red-700">{t("erase")}</span>
                <span className="block text-xs text-gray-500">{t("eraseHint")}</span>
              </span>
            </button>
          ) : target.role !== "GUEST" && !target.isAnonymized ? (
            <p className="text-xs text-gray-500">{t("eraseNotGuest")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

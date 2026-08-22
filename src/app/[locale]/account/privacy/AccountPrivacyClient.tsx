"use client";

import { useState, useTransition } from "react";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { anonymizeGuestAccountAction } from "@/actions/account-privacy";
import WebPushOptIn from "@/components/WebPushOptIn";
import ConfirmDialog from "@/components/common/ConfirmDialog";

export default function AccountPrivacyClient() {
  const t = useTranslations("AccountPrivacy");
  const tCommon = useTranslations("Common");
  const { data: session } = useSession();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const exportData = () => {
    window.location.href = "/api/account/data-export";
  };

  const anonymize = () => {
    setConfirmOpen(false);
    setError(null);
    startTransition(async () => {
      const r = await anonymizeGuestAccountAction();
      if (!r.success) {
        if (r.error === "Errors.accountDeleteActiveBookings") {
          setError(t("errors.activeBookings"));
        } else if (r.error === "Errors.authRequired") {
          setError(t("errors.authRequired"));
        } else if (r.error === "Errors.unauthorized") {
          setError(t("errors.unauthorized"));
        } else {
          setError(t("errors.generic"));
        }
        return;
      }
      await signOut({ callbackUrl: "/" });
    });
  };

  if (session?.user?.role !== "GUEST") {
    return (
      <p className="text-sm text-gray-600">{t("guestOnly")}</p>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <WebPushOptIn />
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-gray-900">{t("exportTitle")}</h2>
        <p className="mt-2 text-sm text-gray-600">{t("exportDesc")}</p>
        <button
          type="button"
          onClick={exportData}
          className="mt-4 rounded-full border border-gray-200 px-6 py-3 text-xs font-black uppercase tracking-widest text-gray-900 hover:bg-gray-50"
        >
          {t("exportButton")}
        </button>
      </div>
      <div className="rounded-2xl border border-red-100 bg-red-50/40 p-6">
        <h2 className="text-lg font-black text-red-900">{t("deleteTitle")}</h2>
        <p className="mt-2 text-sm text-red-800/90">{t("deleteDesc")}</p>
        {error ? (
          <p className="mt-2 text-sm font-bold text-red-700">{error}</p>
        ) : null}
        {/*
          ONAY ADIMI.

          Bu buton eskiden TEK TIKLA çalışıyordu: hesap anonimleştiriliyor ve
          oturum kapatılıyordu — geri alınamaz bir işlem, onaysız. Kod tabanındaki
          diğer tüm yıkıcı işlemlerde onay var (`ConfirmDialog` / `askConfirm`);
          misafirin yapabileceği EN yıkıcı işlemde yoktu. Mobilde yanlış dokunuş
          bunun için fazlasıyla kolay.
        */}
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
          className="mt-4 rounded-full bg-red-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "…" : t("deleteButton")}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t("deleteConfirmTitle")}
        message={t("deleteConfirmBody")}
        confirmLabel={t("deleteConfirmYes")}
        cancelLabel={tCommon("cancel")}
        onConfirm={anonymize}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

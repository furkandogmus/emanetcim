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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /*
    ARTIK FETCH + BLOB (2026-09-10). Eskiden `window.location.href` ile TAM
    SAYFA GEÇİŞİ yapılıyordu: butonda yükleniyor göstergesi yoktu (dört
    paralel DB sorgusu bir an sürer, misafir tekrar tıklamaya eğilimliydi ve
    ardışık tıklamalar dakikalık hız sınırını tetikleyebiliyordu) ve uç
    401/429 döndüğünde tarayıcı UYGULAMADAN ÇIKIP o HAM JSON gövdesini
    (`{"error":"Too many requests"}`) tüm sayfa içeriği olarak gösteriyordu —
    ne BagajPark arayüzü, ne çeviri, ne geri dönüş yolu. Fetch ile aynı hata
    şimdi bu sayfada, çevrilmiş metinle kalıyor.
  */
  const exportData = async () => {
    setExportError(null);
    setExporting(true);
    try {
      const res = await fetch("/api/account/data-export");
      if (!res.ok) {
        setExportError(t("errors.generic"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bagajpark-data-${session?.user?.id?.slice(0, 8) ?? "export"}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t("errors.generic"));
    } finally {
      setExporting(false);
    }
  };

  const anonymize = () => {
    setConfirmOpen(false);
    setError(null);
    startTransition(async () => {
      /*
        `anonymizeGuestAccountAction` icindeki $transaction hicbir try/catch
        icinde degil -- beklenmedik bir DB hatasinda hala firlar. catch
        olmadan bu sessizce yutuluyordu: hesap silme gibi geri donusu olmayan
        bir islemde misafir hicbir sonuc gormeden kaliyordu.
      */
      try {
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
      } catch {
        setError(t("errors.generic"));
      }
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
        {exportError ? (
          <p className="mt-2 text-sm font-bold text-red-700">{exportError}</p>
        ) : null}
        <button
          type="button"
          disabled={exporting}
          onClick={() => void exportData()}
          className="mt-4 rounded-full border border-gray-200 px-6 py-3 text-xs id-eyebrow text-gray-900 hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting ? "…" : t("exportButton")}
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
          className="mt-4 rounded-full bg-red-600 px-6 py-3 text-xs id-eyebrow text-white hover:bg-red-700 disabled:opacity-50"
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

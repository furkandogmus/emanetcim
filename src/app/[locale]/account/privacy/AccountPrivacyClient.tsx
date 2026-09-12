"use client";

import { useState, useTransition } from "react";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Download, UserX } from "lucide-react";
import { anonymizeGuestAccountAction } from "@/actions/account-privacy";
import WebPushOptIn from "@/components/WebPushOptIn";
import ConfirmDialog from "@/components/common/ConfirmDialog";

export default function AccountPrivacyClient() {
  const t = useTranslations("AccountPrivacy");
  const tCommon = useTranslations("Common");
  const { data: session, status } = useSession();
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

  /*
    `status` OLMADAN BU KONTROL YANLIS ANI OKUYORDU: next-auth istemcideki
    ILK render'da her zaman `status:"loading", data:undefined` doner, yani
    `session?.user?.role` bir sure `undefined` kalir. Kontrol bunu beklemeden
    calistigi icin GERCEK bir misafir bile sayfayi her acisinda once
    "bu sayfa yalnizca misafirler icin" reddini goruyor, oturum cozulunce
    reddin yerini asil icerik aliyordu -- her yuklemede goz kirpan bir hata.
    Red artik yalnizca `status` kesinlestikten sonra ciziliyor; arada
    icerigin yerini tutan bir iskelet var (yeni ceviri anahtari gerektirmesin
    diye metinsiz).
  */
  if (status === "loading") {
    return (
      <div className="flex max-w-lg flex-col gap-6" aria-busy="true" aria-hidden>
        <div className="h-40 w-full animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-64 w-full animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (session?.user?.role !== "GUEST") {
    return (
      <p className="text-sm text-gray-600">{t("guestOnly")}</p>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <WebPushOptIn />
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-black text-gray-900">
          <Download size={20} className="text-gray-400" aria-hidden />
          {t("exportTitle")}
        </h2>
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
        <h2 className="flex items-center gap-2 text-lg font-black text-red-900">
          <UserX size={20} className="text-red-700" aria-hidden />
          {t("deleteTitle")}
        </h2>
        <p className="mt-2 text-sm text-red-800/90">{t("deleteDesc")}</p>
        {/*
          SOMUT SONUC LISTESI (2026-09-10). Eskiden tek cumlelik ozet
          ("kisisel verileriniz silinir") vardi; kullanicinin geri alinamaz
          bu eylemi yeterince bilinçli sekilde secip secmedigi belirsizdi.
          Asagida gercekten ne oldugunu (AccountPrivacyService.anonymizeSelf)
          birebir yansitan dört madde var.
        */}
        <ul className="mt-3 flex flex-col gap-1.5 text-xs font-semibold text-red-800/80">
          <li className="flex gap-2">
            <span aria-hidden>•</span>
            {t("deleteConsequenceIdentity")}
          </li>
          <li className="flex gap-2">
            <span aria-hidden>•</span>
            {t("deleteConsequenceReviews")}
          </li>
          <li className="flex gap-2">
            <span aria-hidden>•</span>
            {t("deleteConsequenceBookings")}
          </li>
          <li className="flex gap-2 text-red-900">
            <span aria-hidden>•</span>
            {t("deleteConsequenceIrreversible")}
          </li>
        </ul>
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
        typedConfirmation={{
          phrase: t("deleteTypeConfirmPhrase"),
          label: t("deleteTypeConfirmLabel", { phrase: t("deleteTypeConfirmPhrase") }),
        }}
      />
    </div>
  );
}

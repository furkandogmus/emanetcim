"use client";

import { useState, useTransition } from "react";
import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { UserX } from "lucide-react";
import { anonymizeGuestAccountAction, requestAccountDeletionAction } from "@/actions/account-privacy";
import WebPushOptIn from "@/components/WebPushOptIn";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { formatInstant } from "@/lib/format-datetime";
import DataExportCard from "./DataExportCard";

type DeletionRequestState = { status: "PENDING"; dueAtIso: string } | null;

export default function AccountPrivacyClient({ deletionRequest = null }: { deletionRequest?: DeletionRequestState }) {
  const t = useTranslations("AccountPrivacy");
  const tCommon = useTranslations("Common");
  const { data: session, status } = useSession();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  // Esnaf ve yonetici aninda silemez (dukkan, hakedis, yetki): talep birakir (App Store 5.1.1(v)).
  const fileStem = session?.user?.id?.slice(0, 8) ?? "export";
  if (session?.user?.role !== "GUEST") {
    return (
      <div className="flex max-w-lg flex-col gap-6">
        <DataExportCard fileStem={fileStem} />
        <DeletionRequestCard initial={deletionRequest} />
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <WebPushOptIn />
      <DataExportCard fileStem={fileStem} />
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

function DeletionRequestCard({ initial }: { initial: DeletionRequestState }) {
  const t = useTranslations("AccountPrivacy");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [state, setState] = useState<DeletionRequestState>(initial);
  const [justSent, setJustSent] = useState<{ days: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () => {
    setConfirmOpen(false);
    setError(null);
    startTransition(async () => {
      try {
        const r = await requestAccountDeletionAction({ locale });
        if (!r.success) {
          setError(
            r.error === "Errors.accountDeletionLastAdmin"
              ? t("errors.lastAdmin")
              : r.error === "Errors.accountDeletionGuest"
                ? t("errors.guestUseDelete")
                : r.error === "Errors.notFound"
                  ? t("errors.notFound")
                  : t("errors.generic"),
          );
          return;
        }
        setState({ status: "PENDING", dueAtIso: r.dueAtIso });
        setJustSent({ days: r.slaDays });
      } catch {
        setError(t("errors.generic"));
      }
    });
  };

  const dueDate = state ? formatInstant(state.dueAtIso, locale, { dateStyle: "long" }) : "";

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="rounded-2xl border border-red-100 bg-red-50/40 p-6">
        <h2 className="flex items-center gap-2 text-lg id-display text-red-900">
          <UserX size={20} className="text-red-700" aria-hidden />
          {t("requestTitle")}
        </h2>
        {state ? (
          <div role="status" className="mt-2 flex flex-col gap-1 text-sm text-red-900">
            {justSent ? <p className="font-bold">{t("requestReceivedBody", { days: justSent.days })}</p> : null}
            <p>{t("requestPendingBody", { date: dueDate })}</p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-red-800/90">{t("requestDesc")}</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-xs font-semibold text-red-800/80">
              <li className="flex gap-2">
                <span aria-hidden>•</span>
                {t("requestConsequenceShops")}
              </li>
              <li className="flex gap-2">
                <span aria-hidden>•</span>
                {t("requestConsequenceTimeline")}
              </li>
              <li className="flex gap-2 text-red-900">
                <span aria-hidden>•</span>
                {t("deleteConsequenceIrreversible")}
              </li>
            </ul>
            {error ? <p className="mt-2 text-sm font-bold text-red-700">{error}</p> : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmOpen(true)}
              className="mt-4 rounded-full bg-red-600 px-6 py-3 text-xs id-eyebrow text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "…" : t("requestButton")}
            </button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={t("requestConfirmTitle")}
        message={t("requestConfirmBody")}
        confirmLabel={t("requestConfirmYes")}
        cancelLabel={tCommon("cancel")}
        onConfirm={send}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

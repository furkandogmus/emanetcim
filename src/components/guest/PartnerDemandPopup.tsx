"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Store, X } from "lucide-react";
import { Link } from "@/i18n/routing";

/**
 * Talep testi noktasinda ESNAFA seslenen kart.
 *
 * NEDEN BURADA: bir semtte dukkani olan kisi, o semtin adini aratir. Yani
 * prelaunch nokta sayfasini goren ziyaretcinin bir kismi tam da aradigimiz
 * kisidir -- ve ona soyleyecek somut bir seyimiz var: "burada N kisi emanet
 * noktasi aradi". Soyut bir "partner olun" cagrisindan farki, kendi semtinin
 * OLCULMUS talebini gostermesi.
 *
 * NEDEN MODAL DEGIL: tam ekran bir katman, sayfaya gelen misafirin (asil
 * kullanicinin) isini keser ve klavye tuzagi riski dogurur. Bu kart kosede
 * durur, odagi calmaz, kapatilir ve KAPANDIGINDA HATIRLANIR -- ayni kisiye her
 * sayfada tekrar cikan bir kutu, mesaji degil urunu itibarsizlastirir.
 *
 * DURUSTLUK: sayi esigin altindaysa rakam HIC yazilmaz (`partnerPopupBodyEarly`).
 * Bir esnafa "3 kisi aradi" demek, onu dukkan acmaya cagiran bir cumlede
 * ikna edici degil; uydurmak ise bu kod tabaninin defalarca duzelttigi hata.
 */

/** Kapatildiktan sonra bu kadar sure hic gosterilmez. */
const SNOOZE_DAYS = 30;
/** Sayfa aciliminda hemen degil: once misafirin kendi isini gormesine izin ver. */
const APPEAR_AFTER_MS = 12_000;
/**
 * Rakami yazmaya deger bulmadigimiz esik.
 *
 * `become-partner` sayfasindaki `SOCIAL_PROOF_MIN_COUNT` ile ayni gerekce:
 * kucuk bir rakami oldugu gibi gostermek ikna edici degil, ama uydurma bir
 * sayi da yazilmaz. Ikisi ayni sayi olmak zorunda degil -- bu ekranda tek bir
 * noktanin talebi konusuluyor, orada 3 kisi anlamli bir sinyaldir.
 */
const DEMAND_SHOW_MIN = 3;

const STORAGE_KEY = "bagajpark_partner_popup_dismissed_at";

export default function PartnerDemandPopup({
  district,
  wantCount,
}: {
  district: string;
  wantCount: number;
}) {
  const t = useTranslations("Guest");
  const tCommon = useTranslations("Common");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissedAt = 0;
    try {
      dismissedAt = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
    } catch {
      // Ozel pencere / depolama kapali: kart yine gosterilir, hatirlanmaz.
    }
    const snoozeMs = SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    if (dismissedAt && Date.now() - dismissedAt < snoozeMs) return;

    const timer = window.setTimeout(() => setVisible(true), APPEAR_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Depolama yoksa yalnizca bu sayfa gorunumu icin kapanir.
    }
  }

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label={t("partnerPopupTitle")}
      data-testid="partner-demand-popup"
      className="fixed bottom-24 left-4 z-30 w-[min(22rem,calc(100vw-2rem))] id-surface border border-gray-200 bg-white p-5 shadow-2xl flex flex-col gap-3 md:bottom-6"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={tCommon("close")}
        className="absolute right-3 top-3 text-gray-400 hover:text-gray-700"
      >
        <X size={16} />
      </button>

      <h2 className="flex items-center gap-2 pr-6 text-sm id-display text-gray-900">
        <Store size={16} className="id-accent shrink-0" />
        {t("partnerPopupTitle")}
      </h2>

      <p className="text-sm text-gray-600">
        {wantCount >= DEMAND_SHOW_MIN
          ? t("partnerPopupBodyWithDemand", { district, count: wantCount })
          : t("partnerPopupBodyEarly")}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/become-partner" className="btn-ui btn-ui-md btn-ui-primary">
          {t("partnerPopupCta")}
        </Link>
        <Link href="/demand" className="btn-ui btn-ui-md btn-ui-ghost">
          {t("partnerPopupSecondary")}
        </Link>
      </div>
    </aside>
  );
}

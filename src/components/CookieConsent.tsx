"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent-storage-key";

export { COOKIE_CONSENT_STORAGE_KEY };

export type CookieConsentScope = "all" | "essential";

declare global {
  interface WindowEventMap {
    "bagajpark:cookie-consent": CustomEvent<{ scope: CookieConsentScope }>;
  }
}

/**
 * Serit gorunurken govdenin altinda ayrilacak alani bildiren CSS degiskeni.
 * `[locale]/layout.tsx` icindeki `<main>` dolgusu bunu okur.
 */
const CONSENT_HEIGHT_VAR = "--consent-h";

export default function CookieConsent() {
  const t = useTranslations("CookieConsent");
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const v = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
        const show = v !== "all" && v !== "essential";
        if (show) setVisible(true);
      } catch {
        setVisible(true);
      }
    });
  }, []);

  const persist = useCallback((scope: CookieConsentScope) => {
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, scope);
    } catch {
      /* storage unavailable */
    }
    setVisible(false);
    window.dispatchEvent(
      new CustomEvent("bagajpark:cookie-consent", { detail: { scope } }),
    );
  }, []);

  const p = pathname ?? "";
  const hideOnCriticalFlow =
    p.includes("/checkout/") ||
    p.includes("/shop/") ||
    p.includes("/login") ||
    p.includes("/register") ||
    p.includes("/auth/");

  const shown = visible && !hideOnCriticalFlow;

  /**
   * SERIDIN YUKSEKLIGINI GOVDEYE REZERVE ET.
   *
   * Serit `fixed` + `z-[100]` cizildigi icin akistan cikiyordu ve hicbir yer
   * kapladigi yeri hesaba katmiyordu: olculdu (2026-09-12, 1440x900) her
   * goruntu alaninin ALT 121 px'i kaliciyla ortuluydu ve ana sayfada "Nasil
   * calisir" adimlarinin uzerine biniyordu. Kullanici seridi kapatmadan o
   * icerigi okuyamiyordu -- kaydirmak da ise yaramiyor, cunku serit ekrana
   * sabit.
   *
   * Yukseklik SABIT YAZILAMAZ: metin alti dilde farkli sariyor, telefonda
   * dugmeler alt satira gecebiliyor, `env(safe-area-inset-bottom)` cihaza gore
   * degisiyor. Bu yuzden gercek `offsetHeight` olculup degiskene yaziliyor ve
   * `ResizeObserver` dil/yon/kirilim degisiminde yeniden olcuyor.
   *
   * Serit yokken degisken 0px'e cekiliyor, yani sayfa eski dolgusuna doner.
   */
  useEffect(() => {
    const root = document.documentElement;
    const el = bannerRef.current;
    if (!shown || !el) {
      root.style.setProperty(CONSENT_HEIGHT_VAR, "0px");
      return;
    }
    const sync = () =>
      root.style.setProperty(CONSENT_HEIGHT_VAR, `${el.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty(CONSENT_HEIGHT_VAR, "0px");
    };
  }, [shown]);

  if (!shown) return null;

  return (
    <div
      ref={bannerRef}
      /*
        `role="dialog"` DEGIL, `role="region"`.

        Olculdu (2026-09-12): serit `role="dialog"` ilan ediyordu ama sozlesmenin
        hicbirini tutmuyordu -- acilista odak almiyor, odagi tuzaklamiyor,
        Escape'i dinlemiyordu. "Tumunu kabul et" dugmesi sayfadaki 62
        odaklanabilir ogenin 62.'siydi, yani ekran okuyucuya "bir iletisim
        kutusu acildi" denip kullanici o kutuya ulasmak icin 61 durak sekme
        yapmak zorunda birakiliyordu.

        Iki cozumden BU secildi (serit gercek bir dialog YAPILMADI), cunku
        serit sayfayi engellemiyor: arkasindaki icerik okunabilir ve
        kullanilabilir olmali. Cerez bildirimini odak tuzagina almak, kullaniciyi
        karar verene kadar siteden kilitlemek demektir -- rizanin serbestce
        verilmesi gerekir, zorlanmasi degil. `region` + baslikla adlandirma
        bildirimi ekran okuyucunun yer imi listesine sokar; kullanici hazir
        oldugunda oraya atlar. `aria-labelledby` zaten `<h2>`yi gosteriyor,
        yani bolgenin adi cevrili metinden geliyor -- yeni bir anahtar gerekmez.

        Not: `modal-a11y.test.ts` yalnizca `fixed inset-0` cizen (tam ekran
        ortan) bileseni modal sayar; bu serit `fixed left-0 right-0` ile alt
        seride yapisiyor, dolayisiyla o mandalin kapsamina bilerek girmiyor.
      */
      role="region"
      aria-labelledby="cookie-consent-title"
      data-testid="cookie-consent-banner"
      className="fixed left-0 right-0 z-[100] border-t border-gray-200 bg-white/95 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md md:bottom-0 md:p-6 bottom-[calc(5rem+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <Cookie
            className="mt-1 h-6 w-6 shrink-0 text-orange-600"
            aria-hidden
          />
          <div>
            <h2
              id="cookie-consent-title"
              className="text-base font-bold text-gray-900"
            >
              {t("bannerTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{t("bannerText")}</p>
            <p className="mt-2 text-xs text-gray-500">
              {t("linksIntro")}{" "}
              <Link
                href="/privacy"
                className="font-semibold text-orange-600 underline"
              >
                {t("privacy")}
              </Link>
              {" · "}
              <Link
                href="/kvkk"
                className="font-semibold text-orange-600 underline"
              >
                {t("kvkk")}
              </Link>
            </p>
          </div>
        </div>
        {/*
          Telefonda da YAN YANA: alt alta iken serit bir satir daha uzuyor ve
          844 px'lik bir ekranda listenin ilk sonucunu tamamen ortuyordu
          (2026-08-31, 390 px ekran goruntusu). Iki etiket kisa -- 360 px'te
          yan yana rahat siginca ikinci satira gerek yok.
        */}
        <div className="flex shrink-0 flex-row gap-2 sm:justify-end">
          <button
            type="button"
            data-testid="cookie-consent-essential"
            className="flex-1 sm:flex-none rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            onClick={() => persist("essential")}
          >
            {t("essentialOnly")}
          </button>
          <button
            type="button"
            data-testid="cookie-consent-accept"
            className="flex-1 sm:flex-none rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
            onClick={() => persist("all")}
          >
            {t("acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}

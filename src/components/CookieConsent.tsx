"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function CookieConsent() {
  const t = useTranslations("CookieConsent");
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

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

  if (!visible || hideOnCriticalFlow) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      data-testid="cookie-consent-banner"
      className="fixed left-0 right-0 z-[100] border-t border-gray-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md md:bottom-0 md:p-6 bottom-[calc(5rem+env(safe-area-inset-bottom))]"
    >
      {/* Mobilde kompakt: banner arama sayfasının sonuç listesinin üstüne
          bindiği için dikey alan minimumda tutuluyor. */}
      <div className="mx-auto flex max-w-7xl flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex gap-2.5 md:gap-3">
          <Cookie
            className="mt-0.5 h-5 w-5 shrink-0 text-orange-600 md:mt-1 md:h-6 md:w-6"
            aria-hidden
          />
          <div>
            <h2
              id="cookie-consent-title"
              className="text-sm font-bold text-gray-900 md:text-base"
            >
              {t("bannerTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-gray-600 md:mt-1 md:text-sm">{t("bannerText")}</p>
            <p className="mt-1 text-xs text-gray-500 md:mt-2">
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
        {/* Mobilde butonlar yan yana — alt alta dizilmek banner'ı iki kat uzatıyordu. */}
        <div className="flex shrink-0 flex-row gap-2 sm:justify-end">
          <button
            type="button"
            data-testid="cookie-consent-essential"
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 sm:flex-none"
            onClick={() => persist("essential")}
          >
            {t("essentialOnly")}
          </button>
          <button
            type="button"
            data-testid="cookie-consent-accept"
            className="flex-1 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 sm:flex-none"
            onClick={() => persist("all")}
          >
            {t("acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}

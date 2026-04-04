"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Cookie } from "lucide-react";

export const COOKIE_CONSENT_STORAGE_KEY = "emanetci-cookie-consent";

export type CookieConsentScope = "all" | "essential";

declare global {
  interface WindowEventMap {
    "emanetci:cookie-consent": CustomEvent<{ scope: CookieConsentScope }>;
  }
}

export default function CookieConsent() {
  const t = useTranslations("CookieConsent");
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
      new CustomEvent("emanetci:cookie-consent", { detail: { scope } }),
    );
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      data-testid="cookie-consent-banner"
      className="fixed bottom-0 left-0 right-0 z-[100] border-t border-gray-200 bg-white/95 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md md:p-6"
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
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-testid="cookie-consent-essential"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            onClick={() => persist("essential")}
          >
            {t("essentialOnly")}
          </button>
          <button
            type="button"
            data-testid="cookie-consent-accept"
            className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
            onClick={() => persist("all")}
          >
            {t("acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}

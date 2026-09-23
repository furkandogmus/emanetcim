"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useStandaloneMode } from "@/lib/hooks/useStandaloneMode";
import {
  PWA_BOOKED_EVENT,
  countVisit,
  dismissInstall,
  hasBooked,
  isInstallDismissed,
  isInstallEligible,
  isIosDevice,
} from "@/lib/pwa-install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Ana ekrana ekleme daveti. Ne zaman / kime: `src/lib/pwa-install.ts`.
 * Chrome/Android'de tarayicinin kurulum penceresini acar; iOS'ta o pencere
 * olmadigi icin "Paylas -> Ana Ekrana Ekle" adimini gosterir.
 */
export default function PWAInstallBanner() {
  const t = useTranslations("Common");
  const { isStandalone } = useStandaloneMode();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [justBooked, setJustBooked] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDismissed = isInstallDismissed();
    const visits = countVisit();
    const booked = hasBooked();
    const onIos = isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0);
    setTimeout(() => {
      setDismissed(isDismissed);
      setEligible(isInstallEligible(booked, visits));
      setIos(onIos);
    }, 0);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onBooked = () => {
      setEligible(true);
      setJustBooked(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener(PWA_BOOKED_EVENT, onBooked);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener(PWA_BOOKED_EVENT, onBooked);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setDeferred(null);
    dismissInstall();
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    dismiss();
  }, [deferred, dismiss]);

  // Erken return'ler hook'lardan SONRA — [[react-hooks/rules-of-hooks]].
  if (isStandalone || dismissed || !eligible) return null;
  if (!deferred && !ios) return null;

  const body = ios
    ? t("pwaInstallIosBody")
    : justBooked
      ? t("pwaInstallAfterBookingBody")
      : t("pwaInstallBody");

  return (
    <div
      // 2026-08-21: 4.5rem -> 6rem, ayni sebep CheckoutClient.tsx'teki footer'la ayni
      // (mobil alt nav gercek yuksekligi ~80px, 4.5rem=72px yetersizdi)
      className="fixed z-[45] max-md:bottom-[calc(6rem+env(safe-area-inset-bottom))] max-md:left-3 max-md:right-3 md:bottom-4 md:right-4 md:left-auto md:max-w-sm"
      role="dialog"
      aria-labelledby="pwa-install-title"
    >
      <div className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl shadow-gray-200/50">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white">
          {ios ? <Share className="h-5 w-5" aria-hidden /> : <Download className="h-5 w-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <p
            id="pwa-install-title"
            className="text-sm font-black uppercase tracking-wide text-gray-900"
          >
            {t("pwaInstallTitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">{body}</p>
          {ios && justBooked ? (
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              {t("pwaInstallAfterBookingBody")}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {ios ? null : (
              <button
                type="button"
                onClick={install}
                className="rounded-full bg-orange-600 px-4 py-2 id-eyebrow text-white hover:bg-orange-700"
              >
                {t("pwaInstallCta")}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full border border-gray-200 px-4 py-2 id-eyebrow text-gray-500 hover:bg-gray-50"
            >
              {ios ? t("pwaInstallIosDone") : t("pwaInstallDismiss")}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          aria-label={t("pwaInstallDismiss")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

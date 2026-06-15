"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useStandaloneMode } from "@/lib/hooks/useStandaloneMode";

const DISMISS_KEY = "bagajpark-pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PWAInstallBanner() {
  const t = useTranslations("Common");
  const { isStandalone } = useStandaloneMode();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  if (isStandalone) return null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* private mode */
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setDeferred(null);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    dismiss();
  }, [deferred, dismiss]);

  if (!visible || !deferred) return null;

  return (
    <div
      className="fixed z-[45] max-md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] max-md:left-3 max-md:right-3 md:bottom-4 md:right-4 md:left-auto md:max-w-sm"
      role="dialog"
      aria-labelledby="pwa-install-title"
    >
      <div className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl shadow-gray-200/50">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white">
          <Download className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p
            id="pwa-install-title"
            className="text-sm font-black uppercase tracking-wide text-gray-900"
          >
            {t("pwaInstallTitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            {t("pwaInstallBody")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={install}
              className="rounded-full bg-orange-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-orange-700"
            >
              {t("pwaInstallCta")}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full border border-gray-200 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50"
            >
              {t("pwaInstallDismiss")}
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

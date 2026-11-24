"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { APP_STORES_OFF, anyStoreLive, detectAppPlatform, type AppStoreFlags } from "@/lib/app-stores-shared";
import { normalizeAppDiscountPct } from "@/lib/app-discount";

/**
 * "Uygulamada %10 daha ucuz" satiri (dukkan ve odeme sayfasi). Oran 0 ya da hicbir
 * magaza yayinda degilse cizilmez: verilecek bir bag yok. iOS'ta App Store yayindaysa
 * Safari akilli bandi zaten ayni isi yaptigi icin gizlenir; Android ve masaustunde gorunur.
 */
export default function AppDiscountHint({
  pct,
  source,
  className = "",
}: {
  pct: number;
  /** `/app?kaynak=` etiketi; `web-*` bicimi (`normalizeAppLinkSource`). */
  source: "web-shop" | "web-checkout";
  className?: string;
}) {
  const t = useTranslations("AppDiscount");
  const [flags, setFlags] = useState<AppStoreFlags>(APP_STORES_OFF);
  const [hasSmartBanner, setHasSmartBanner] = useState(false);
  const p = normalizeAppDiscountPct(pct);

  useEffect(() => {
    if (p <= 0) return;
    const ctrl = new AbortController();
    fetch("/api/app-stores", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : APP_STORES_OFF))
      .then((f: AppStoreFlags) => {
        const next = { iosAppStoreLive: f.iosAppStoreLive === true, androidPlayLive: f.androidPlayLive === true };
        setFlags(next);
        setHasSmartBanner(next.iosAppStoreLive && detectAppPlatform(navigator.userAgent) === "ios");
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [p]);

  if (p <= 0 || !anyStoreLive(flags) || hasSmartBanner) return null;
  const href = `/app?kaynak=${source}`;
  return (
    <p className={`text-xs text-gray-500 ${className}`} data-testid="app-discount-hint">
      {t("hint", { pct: p })}{" "}
      {flags.iosAppStoreLive ? (
        <a href={href} className="font-bold text-orange-600 hover:underline">
          {t("appStore")}
        </a>
      ) : null}
      {flags.iosAppStoreLive && flags.androidPlayLive ? " · " : null}
      {flags.androidPlayLive ? (
        <a href={href} className="font-bold text-orange-600 hover:underline">
          {t("googlePlay")}
        </a>
      ) : null}
    </p>
  );
}

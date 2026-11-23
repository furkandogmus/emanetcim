"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import StoreBadges from "@/components/app-promo/StoreBadges";
import { APP_STORES_OFF, anyStoreLive, type AppStoreFlags } from "@/lib/app-stores-shared";

/**
 * Altbilgi rozetleri. Bayrak istemcide okunur: altbilgi statik sayfalara
 * build aninda gomuluyor ve oradaki bayrak deploy'a kadar donardi.
 * Kapaliyken (ve yuklenirken) hicbir sey cizilmez.
 */
export default function FooterStoreBadges() {
  const t = useTranslations("AppDownload");
  const [flags, setFlags] = useState<AppStoreFlags>(APP_STORES_OFF);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/app-stores", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : APP_STORES_OFF))
      .then((f: AppStoreFlags) =>
        setFlags({ iosAppStoreLive: f.iosAppStoreLive === true, androidPlayLive: f.androidPlayLive === true }),
      )
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  if (!anyStoreLive(flags)) return null;
  return (
    <div className="mt-8" data-testid="footer-store-badges">
      <p className="mb-3 text-xs id-eyebrow text-gray-900">{t("footerTitle")}</p>
      <StoreBadges
        flags={flags}
        iosHref="/app?kaynak=web-footer"
        androidHref="/app?kaynak=web-footer"
        labels={{ appStore: t("appStoreAlt"), googlePlay: t("googlePlayAlt") }}
      />
    </div>
  );
}

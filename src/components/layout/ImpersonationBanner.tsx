"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { formatInstant } from "@/lib/format-datetime";
import { WEB_IMPERSONATION_STOP_PATH } from "@/lib/web-impersonation-paths";

/** Web "olarak goruntule" serit: her sayfada ustte, cikis dugmesiyle. Sure dolunca sayfa adminle yenilenir. */
export default function ImpersonationBanner() {
  const { data: session } = useSession();
  const t = useTranslations("AdminImpersonation");
  const locale = useLocale();
  const [stopping, setStopping] = useState(false);
  const imp = session?.impersonation;

  useEffect(() => {
    if (!imp?.expiresAt) return;
    const ms = new Date(imp.expiresAt).getTime() - Date.now();
    const timer = setTimeout(() => window.location.reload(), Math.max(0, ms) + 1000);
    return () => clearTimeout(timer);
  }, [imp]);

  if (!imp || !session?.user) return null;

  const stop = async () => {
    setStopping(true);
    try {
      await fetch(WEB_IMPERSONATION_STOP_PATH, { method: "POST" });
    } finally {
      window.location.assign(`/${locale}/admin/users`);
    }
  };

  if (imp.stale) {
    // Cerez duruyor ama hedef artik gecersiz: oturum adminin, yazma yine kapali. Tek cikis bu dugme.
    return (
      <div role="status" className="flex flex-wrap items-center justify-center gap-3 bg-red-700 px-4 py-2 text-sm text-white">
        <Eye size={16} aria-hidden />
        <span className="font-bold">{t("staleBanner")}</span>
        <button
          type="button"
          onClick={stop}
          disabled={stopping}
          aria-label={t("stopLabel")}
          className="rounded-full bg-white px-4 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {t("stop")}
        </button>
      </div>
    );
  }

  const name = session.user.name || session.user.email || "-";
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-3 bg-red-700 px-4 py-2 text-sm text-white">
      <Eye size={16} aria-hidden />
      <span className="font-bold">{t("banner", { name })}</span>
      <span className="opacity-80">
        {t("bannerReadOnly", { time: formatInstant(imp.expiresAt, locale, { timeStyle: "short" }) })}
      </span>
      <button
        type="button"
        onClick={stop}
        disabled={stopping}
        aria-label={t("stopLabel")}
        className="rounded-full bg-white px-4 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {t("stop")}
      </button>
    </div>
  );
}

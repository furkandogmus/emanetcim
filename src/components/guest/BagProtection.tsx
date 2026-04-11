"use client";

import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

type Variant = "checkout" | "landing";

export default function BagProtection({ variant }: { variant: Variant }) {
  const t = useTranslations("Guest");

  const wrap =
    variant === "checkout"
      ? "bg-green-50 border border-green-100 p-5 rounded-3xl flex items-start gap-4"
      : "rounded-2xl border border-orange-100 bg-orange-50/60 p-5 flex items-start gap-4";

  const iconWrap =
    variant === "checkout"
      ? "bg-green-600 p-2 rounded-xl text-white shrink-0"
      : "bg-orange-600 p-2 rounded-xl text-white shrink-0";

  const titleClass =
    variant === "checkout"
      ? "font-bold text-green-900 text-sm"
      : "font-bold text-gray-900 text-sm";

  const bodyClass =
    variant === "checkout"
      ? "text-green-700 text-xs leading-relaxed mt-1"
      : "text-gray-600 text-xs leading-relaxed mt-1";

  return (
    <div className={wrap}>
      <div className={iconWrap}>
        <ShieldCheck size={variant === "checkout" ? 24 : 22} aria-hidden />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-orange-600/80 mb-1">
          {t("bagProtectionBadge")}
        </p>
        <h3 className={titleClass}>{t("bagProtectionTitle")}</h3>
        <p className={bodyClass}>{t("bagProtectionBody")}</p>
      </div>
    </div>
  );
}

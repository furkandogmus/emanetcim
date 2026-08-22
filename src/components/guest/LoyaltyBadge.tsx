"use client";

import { Gift } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatTryCurrency } from "@/lib/currency";

interface Props {
  points: number;
  locale?: string;
}

export default function LoyaltyBadge({ points, locale }: Props) {
  // Hook'lar erken dönüşten ÖNCE çağrılmalı (React kuralları).
  const t = useTranslations("Guest");

  if (points < 50) return null;

  const value = Math.floor(points / 100);

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white px-3 py-1 shadow-sm">
      <Gift size={14} />
      <span className="text-[10px] font-black uppercase tracking-wider">
        {points} {t("loyaltyPoints")} ({formatTryCurrency(value, locale ?? "tr")} {t("loyaltyDiscount")})
      </span>
    </div>
  );
}

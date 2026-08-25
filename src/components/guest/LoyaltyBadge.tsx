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

  // Tam sayıya yuvarlamak 50-99 puan aralığında rozeti "0,00 TRY indirim"
  // gösterirdi (50/100 = 0.5 -> Math.floor -> 0) — rozet görünüyordu ama
  // karşılığı sıfırmış gibi duruyordu. formatTryCurrency ondalığı zaten
  // doğru basıyor, o yüzden burada yuvarlamaya gerek yok.
  const value = points / 100;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white px-3 py-1 shadow-sm">
      <Gift size={14} />
      <span className="text-[10px] font-black uppercase tracking-wider">
        {points} {t("loyaltyPoints")} ({formatTryCurrency(value, locale ?? "tr")} {t("loyaltyDiscount")})
      </span>
    </div>
  );
}

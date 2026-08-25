"use client";

import { Shield, Timer } from "lucide-react";
import { useTranslations } from "next-intl";

interface TrustBadgeProps {
  isVerified: boolean;
  responseTimeMinutes: number | null;
}

export function VerifiedBadge({ isVerified }: { isVerified: boolean }) {
  const t = useTranslations("Guest");
  if (!isVerified) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
      <Shield size={12} aria-hidden="true" />
      {t("verifiedBadge")}
    </span>
  );
}

export function ResponseTimeBadge({ minutes }: { minutes: number | null }) {
  const t = useTranslations("Guest");
  /*
    `null` / 0 = ÖLÇÜM YOK. `ShopService.recomputeResponseTimes` yeterli örneği
    olmayan dükkan için bilerek `null` yazar (P2-7); rozet o zaman hiç çizilmez.
    Uydurulmuş bir sayı, gösterilmeyen bir rozetten daha kötüdür.
  */
  if (minutes == null || minutes <= 0) return null;
  /*
    Eskiden burada bir de `minutes < 1 ? t("responseTimeFast")` dalı vardı; üstteki
    koşul 1'in altını zaten eliyor, yani o dal hiç çalışmıyordu. Hesap dakikayı
    tam sayıya ve en az 1'e yuvarlıyor — sıfır, "veri yok" ile karışırdı.
  */
  const label = t("responseTimeMinutes", { minutes });
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
      <Timer size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

export function TrustBadges({
  isVerified,
  responseTimeMinutes,
}: TrustBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <VerifiedBadge isVerified={isVerified} />
      <ResponseTimeBadge minutes={responseTimeMinutes} />
    </span>
  );
}

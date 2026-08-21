"use client";

import { useTranslations } from "next-intl";

interface CancellationPolicyProps {
  className?: string;
}

// 2026-08-21: Onceden check-in'e kalan sureye gore kademeli bir tahmin gosteriyordu
// (lib/cancellation-policy.ts, "<1h -> credits only"), ama BookingService.cancelBooking()
// bu kademeyi HIC uygulamiyor — kod her zaman tam nakit iade yapiyor ("Bounce-style: full
// refund", ayni dosyada acik yorum). UI kullaniciya "kredi verilecek" derken gercekte tam
// iade oluyordu. Tek dogru kaynak: her zaman tam iade. bkz. UX_AUDIT_BOUNCE_COMPARISON.
export default function CancellationPolicy({ className = "" }: CancellationPolicyProps) {
  const t = useTranslations("Guest");

  return (
    <div className={`text-left space-y-4 ${className}`}>
      <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">
        {t("cancellationPolicyTitle")}
      </h3>
      <div className="flex gap-3 rounded-xl p-3 border border-orange-200 bg-orange-50/80 text-sm text-gray-600 leading-relaxed">
        <span className="font-black text-orange-600 shrink-0">✓</span>
        <span>{t("cancellationTierFullSimple")}</span>
      </div>
    </div>
  );
}

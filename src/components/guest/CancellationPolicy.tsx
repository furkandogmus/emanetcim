"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  CANCEL_FULL_REFUND_MIN_HOURS,
  CANCEL_PARTIAL_REFUND_FRACTION,
  CANCEL_PARTIAL_REFUND_MIN_HOURS,
  estimatePaidRefundForTier,
  getCancellationTier,
} from "@/lib/cancellation-policy";
import { moneyToNumber } from "@/lib/money";

interface CancellationPolicyProps {
  checkInTime: string | Date;
  /** Ödeme alınmış rezervasyonlar için tahmini iade satırı gösterilir */
  showRefundEstimate?: boolean;
  totalPaidTry?: number;
  className?: string;
}

/**
 * İptal öncesi kademeli politika özeti (check-in’e kalan süre).
 */
export default function CancellationPolicy({
  checkInTime,
  showRefundEstimate = false,
  totalPaidTry = 0,
  className = "",
}: CancellationPolicyProps) {
  const t = useTranslations("Guest");
  const checkIn = useMemo(() => new Date(checkInTime), [checkInTime]);
  const tier = useMemo(() => getCancellationTier(checkIn), [checkIn]);
  const estimate = useMemo(
    () => estimatePaidRefundForTier(moneyToNumber(totalPaidTry), tier),
    [totalPaidTry, tier]
  );

  const partialPercent = Math.round(CANCEL_PARTIAL_REFUND_FRACTION * 100);

  return (
    <div className={`text-left space-y-4 ${className}`}>
      <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">
        {t("cancellationPolicyTitle")}
      </h3>
      <ul className="space-y-3 text-sm text-gray-600 leading-relaxed">
        <li
          className={`flex gap-3 rounded-xl p-3 border ${
            tier === "FULL"
              ? "border-orange-200 bg-orange-50/80"
              : "border-gray-100 bg-gray-50/50"
          }`}
        >
          <span className="font-black text-orange-600 shrink-0">1</span>
          <span>
            {t("cancellationTierFull", { hours: CANCEL_FULL_REFUND_MIN_HOURS })}
          </span>
        </li>
        <li
          className={`flex gap-3 rounded-xl p-3 border ${
            tier === "PARTIAL"
              ? "border-orange-200 bg-orange-50/80"
              : "border-gray-100 bg-gray-50/50"
          }`}
        >
          <span className="font-black text-orange-600 shrink-0">2</span>
          <span>
            {t("cancellationTierPartial", {
              minHours: CANCEL_PARTIAL_REFUND_MIN_HOURS,
              maxHours: CANCEL_FULL_REFUND_MIN_HOURS,
              percent: partialPercent,
            })}
          </span>
        </li>
        <li
          className={`flex gap-3 rounded-xl p-3 border ${
            tier === "CREDIT_ONLY"
              ? "border-orange-200 bg-orange-50/80"
              : "border-gray-100 bg-gray-50/50"
          }`}
        >
          <span className="font-black text-orange-600 shrink-0">3</span>
          <span>
            {t("cancellationTierCredit", {
              minHours: CANCEL_PARTIAL_REFUND_MIN_HOURS,
            })}
          </span>
        </li>
      </ul>
      {showRefundEstimate && moneyToNumber(totalPaidTry) > 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-xs font-semibold text-gray-700 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            {t("cancellationYourCase")}
          </p>
          {estimate.isCreditOnly ? (
            <p>{t("cancellationEstimateCredit")}</p>
          ) : (
            <p>
              {t("cancellationEstimateCard", { amount: estimate.cardRefund })}
            </p>
          )}
        </div>
      ) : null}
      {!showRefundEstimate ? (
        <p className="text-xs text-gray-400">{t("cancellationUnpaidNote")}</p>
      ) : null}
    </div>
  );
}

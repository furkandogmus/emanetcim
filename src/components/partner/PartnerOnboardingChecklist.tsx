"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Link } from "@/i18n/routing";

/**
 * DEFECT_BACKLOG D7: yeni (hiç rezervasyonu olmayan) esnaf panele girince
 * sekiz sıfır metrik görüyordu — hiçbir rehberlik yoktu. Bu kart yalnızca
 * `PartnerPage`in "yeni esnaf" saydığı durumda çiziliyor (bkz. sayfa
 * bileşenindeki `isNewPartner` hesabı).
 */
export default function PartnerOnboardingChecklist({
  hasShopImage,
  hasShopLocation,
}: {
  hasShopImage: boolean;
  hasShopLocation: boolean;
}) {
  const t = useTranslations("Partner");

  const steps = [
    { done: hasShopImage, label: t("onboardingStepPhoto") },
    { done: hasShopLocation, label: t("onboardingStepLocation") },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl rounded-4xl border border-orange-100 bg-orange-50/60 p-6 shadow-sm">
      <p className="id-eyebrow text-orange-800/80">{t("onboardingTitle")}</p>
      <p className="mt-1 text-sm font-medium text-gray-600">{t("onboardingSubtitle")}</p>

      <ul className="mt-4 flex flex-col gap-2">
        {steps.map((step) => (
          <li
            key={step.label}
            className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm"
          >
            {step.done ? (
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            ) : (
              <Circle size={18} className="shrink-0 text-gray-300" />
            )}
            <span className={step.done ? "text-gray-400 line-through" : "font-bold text-gray-800"}>
              {step.label}
            </span>
            {!step.done && (
              <Link
                href="/partner/settings"
                className="ml-auto id-display text-xs text-orange-600 uppercase tracking-wider"
              >
                {t("onboardingGo")}
              </Link>
            )}
          </li>
        ))}
        <li className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-gray-500">
          <Clock size={18} className="shrink-0 text-gray-300" />
          {t("onboardingStepFirstBooking")}
        </li>
      </ul>
    </div>
  );
}

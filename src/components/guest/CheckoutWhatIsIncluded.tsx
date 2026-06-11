"use client";

import { useTranslations } from "next-intl";
import { BaggageClaim, ShieldCheck, Clock, Phone } from "lucide-react";

export default function CheckoutWhatIsIncluded() {
  const t = useTranslations("Guest");

  const items = [
    {
      icon: BaggageClaim,
      label: t("checkoutIncludedSeals"),
      desc: t("checkoutIncludedSealsDesc"),
    },
    {
      icon: ShieldCheck,
      label: t("insuranceIncluded"),
      desc: t("checkoutIncludedInsuranceDesc"),
    },
    {
      icon: Clock,
      label: t("searchFreeCancelBadge"),
      desc: t("checkoutIncludedFreeCancelDesc"),
    },
    {
      icon: Phone,
      label: t("checkoutIncludedSupport"),
      desc: t("checkoutIncludedSupportDesc"),
    },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
        {t("checkoutWhatsIncluded")}
      </h3>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <item.icon size={16} className="text-emerald-600" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";

export default function BagSizeGuide() {
  const t = useTranslations("Guest");

  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">
        {t("bagSizeGuide")}
      </h3>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl">
          <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 font-black text-xs flex items-center justify-center shrink-0">S</span>
          <div>
            <p className="text-sm font-bold text-gray-900">{t("bagSizeS")}</p>
            <p className="text-xs text-gray-500">{t("bagSizeSDesc")}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-2xl border border-orange-100">
          <span className="w-8 h-8 rounded-lg bg-orange-600 text-white font-black text-xs flex items-center justify-center shrink-0">M/L</span>
          <div>
            <p className="text-sm font-bold text-gray-900">{t("bagSizeM")}</p>
            <p className="text-xs text-gray-500">{t("bagSizeMDesc")}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl">
          <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 font-black text-xs flex items-center justify-center shrink-0">XL</span>
          <div>
            <p className="text-sm font-bold text-gray-900">{t("bagSizeXl")}</p>
            <p className="text-xs text-gray-500">{t("bagSizeXlDesc")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

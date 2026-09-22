"use client";

import { useTranslations } from "next-intl";
import BagGlyph, { BAG_HEIGHT_UNITS, type BagSize } from "@/components/guest/BagGlyph";

/** Piksel/birim: en buyuk valiz ~115 px. Uc boy ayni olcekte kalir. */
const SCALE = 0.9;

type Props = {
  /** Verilirse her boyun altinda gunluk fiyat gorunur (orn. checkout). */
  prices?: Record<BagSize, string>;
};

export default function BagSizeGuide({ prices }: Props) {
  const t = useTranslations("Guest");

  const sizes: { size: BagSize; chip: string; title: string; desc: string }[] = [
    { size: "s", chip: "S", title: t("bagSizeS"), desc: t("bagSizeSDesc") },
    { size: "m", chip: "M/L", title: t("bagSizeM"), desc: t("bagSizeMDesc") },
    { size: "xl", chip: "XL", title: t("bagSizeXl"), desc: t("bagSizeXlDesc") },
  ];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="mb-5 text-xs id-eyebrow text-gray-500">{t("bagSizeGuide")}</h3>

      <div className="rounded-2xl bg-gradient-to-b from-brand-50/60 to-white px-3 pt-4">
        <div className="grid grid-cols-3 items-end gap-2 border-b-2 border-gray-200">
          {sizes.map(({ size }) => (
            <div key={size} className="flex justify-center">
              <BagGlyph size={size} className="w-auto" style={{ height: BAG_HEIGHT_UNITS[size] * SCALE }} />
            </div>
          ))}
        </div>
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
        {sizes.map(({ size, chip, title, desc }) => (
          <li key={size} className="flex flex-col items-center gap-1">
            <span className="rounded-lg bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">{chip}</span>
            <p className="text-sm font-bold text-gray-900">{title}</p>
            <p className="text-xs leading-snug text-gray-500">{desc}</p>
            {prices && <p className="mt-0.5 text-sm font-bold text-brand-700">{prices[size]}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

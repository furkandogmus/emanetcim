"use client";

import { useTranslations } from "next-intl";

type ComparisonRowKey =
  | "comparisonPrice"
  | "comparisonFlex"
  | "comparisonInsurance"
  | "comparisonNetwork"
  | "comparisonHours";

const ROWS: { key: ComparisonRowKey; us: "yes" | "partial" }[] = [
  { key: "comparisonPrice", us: "yes" },
  { key: "comparisonFlex", us: "yes" },
  { key: "comparisonInsurance", us: "yes" },
  { key: "comparisonNetwork", us: "partial" },
  { key: "comparisonHours", us: "partial" },
];

export default function ComparisonTable() {
  const t = useTranslations("Guest");

  return (
    <section
      className="py-16 px-6 bg-gray-50 border-y border-gray-100"
      aria-labelledby="comparison-heading"
    >
      <div className="mx-auto max-w-3xl">
        <h2
          id="comparison-heading"
          className="text-center text-2xl font-black tracking-tight text-gray-900"
        >
          {t("comparisonTitle")}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          {t("comparisonSubtitle")}
        </p>
        <div className="mt-10 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-4 py-3 font-black uppercase tracking-wider text-[10px] text-gray-400">
                  {t("comparisonColFeature")}
                </th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-[10px] text-orange-600">
                  {t("comparisonColUs")}
                </th>
                <th className="px-4 py-3 font-black uppercase tracking-wider text-[10px] text-gray-400">
                  {t("comparisonColOther")}
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ key, us }) => (
                <tr key={key} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {t(key)}
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900">
                    {us === "partial"
                      ? t("comparisonPartial")
                      : t("comparisonYes")}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {t("comparisonLimited")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

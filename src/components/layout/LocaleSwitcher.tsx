"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

const SHORT: Record<string, string> = {
  tr: "TR",
  en: "EN",
  de: "DE",
  fr: "FR",
  ja: "日本語",
  fa: "فارسی",
};

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Common");

  return (
    <label className="flex items-center gap-1">
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(e) => {
          router.replace(pathname, { locale: e.target.value });
        }}
        /*
          `w-16`: bir <select>un kapali genisligi EN UZUN SECENEGE gore belirlenir,
          gosterdigi degere gore degil. Alti dilin en uzunlari "日本語" ve "فارسی"
          oldugu icin kutu her dilde 89 px yer kapliyordu -- ekranda yalnizca "TR"
          yazarken bile. 360 pikselik bir telefonda baslik satiri bunu kaldiramiyor:
          Fransizca'da giris dugmesi 10 px, logo 12 px kirpiliyordu (2026-08-31'de
          alti dil x bes genislikte olculdu). Acilir liste kendi genisligini
          kendisi belirledigi icin secenekler tam okunmaya devam ediyor.
        */
        className="w-16 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-600 outline-none hover:border-orange-200 focus:ring-2 focus:ring-orange-500/20"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {SHORT[loc] ?? loc}
          </option>
        ))}
      </select>
    </label>
  );
}

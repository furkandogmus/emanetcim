"use client";

import { useLocale } from "next-intl";
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

  return (
    <label className="flex items-center gap-1">
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={locale}
        onChange={(e) => {
          router.replace(pathname, { locale: e.target.value });
        }}
        className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-600 outline-none hover:border-orange-200 focus:ring-2 focus:ring-orange-500/20"
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

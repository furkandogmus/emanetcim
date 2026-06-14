"use client";

import { useState } from "react";
import tr from "@/locales/tr.json";
import en from "@/locales/en.json";
import de from "@/locales/de.json";
import fr from "@/locales/fr.json";
import es from "@/locales/es.json";
import it from "@/locales/it.json";
import zh from "@/locales/zh.json";
import ja from "@/locales/ja.json";
import ar from "@/locales/ar.json";
import ko from "@/locales/ko.json";
import ru from "@/locales/ru.json";
import fa from "@/locales/fa.json";
import bg from "@/locales/bg.json";
import pl from "@/locales/pl.json";
const UI_LOCALES = [
  "tr",
  "en",
  "de",
  "fr",
  "es",
  "it",
  "zh",
  "ja",
  "ar",
  "ko",
  "ru",
  "fa",
  "bg",
  "pl",
] as const;

type UiLocale = (typeof UI_LOCALES)[number];

function pathLocale(pathname: string): UiLocale {
  const seg = pathname.split("/").filter(Boolean)[0];
  return UI_LOCALES.includes(seg as UiLocale) ? (seg as UiLocale) : "tr";
}

const localeBundles = {
  tr,
  en,
  de,
  fr,
  es,
  it,
  zh,
  ja,
  ar,
  ko,
  ru,
  fa,
  bg,
  pl,
} as const;

function commonForLocale(locale: UiLocale) {
  return localeBundles[locale].Common;
}

function htmlLang(locale: UiLocale): string {
  if (locale === "zh") return "zh-Hans";
  return locale;
}

/**
 * Kök hata sınırı — layout hatalarında devreye girer (NextIntlProvider yok; path + JSON ile dil).
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale] = useState<UiLocale>(() => {
    if (typeof window === "undefined") return "tr";
    return pathLocale(window.location.pathname);
  });

  const c = commonForLocale(locale);

  return (
    <html
      lang={htmlLang(locale)}
      dir={locale === "ar" || locale === "fa" ? "rtl" : "ltr"}
    >
      <body className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 p-8 font-sans">
        <h1 className="text-2xl font-black text-gray-900">{c.errorTitle}</h1>
        <p className="text-sm text-gray-600 text-center max-w-md">{c.errorDescription}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-2xl bg-gray-900 px-8 py-3 text-sm font-bold text-white hover:bg-gray-800"
        >
          {c.errorRetry}
        </button>
      </body>
    </html>
  );
}

"use client";

import { useEffect, useState } from "react";
import tr from "@/locales/tr.json";
import en from "@/locales/en.json";

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
  const [locale] = useState<"tr" | "en">(() => {
    if (typeof window === "undefined") return "tr";
    return window.location.pathname.startsWith("/en") ? "en" : "tr";
  });

  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  const c = locale === "en" ? en.Common : tr.Common;

  return (
    <html lang={locale}>
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

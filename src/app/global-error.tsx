"use client";

import { useEffect } from "react";

/**
 * Kök hata sınırı — layout hatalarında devreye girer.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // İstemci tarafı: konsola yaz; Sentry tarayıcı SDK’sı eklendiğinde buraya bağlanabilir.
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="tr">
      <body className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 p-8 font-sans">
        <h1 className="text-2xl font-black text-gray-900">Bir şeyler ters gitti</h1>
        <p className="text-sm text-gray-600 text-center max-w-md">
          Sorun devam ederse destek ile iletişime geçin. Teknik ekip logları inceleyebilir.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-2xl bg-gray-900 px-8 py-3 text-sm font-bold text-white hover:bg-gray-800"
        >
          Tekrar dene
        </button>
      </body>
    </html>
  );
}

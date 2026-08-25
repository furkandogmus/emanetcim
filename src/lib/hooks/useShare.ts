"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface ShareOptions {
  title: string;
  text: string;
  url: string;
}

/**
 * `navigator.share` yoksa (masaüstü tarayıcılar, bazı eski mobil tarayıcılar)
 * veya paylaşım başarısız olursa panoya kopyalıyor. Geri bildirim toast'u
 * i18n'siz sabit İngilizce metindi — Türkçe dahil 6 dilin hiçbirinde
 * çevrilmiyordu, uygulamanın geri kalanı `t()` kullanırken burası atlanmıştı.
 */
export function useShare() {
  const t = useTranslations("Common");

  const share = useCallback(
    async ({ title, text, url }: ShareOptions) => {
      const shareData = { title, text, url };

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share(shareData);
          return true;
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "AbortError") return false;
          fallbackCopy(url, t);
          return true;
        }
      } else {
        fallbackCopy(url, t);
        return true;
      }
    },
    [t],
  );

  return { share };
}

function fallbackCopy(text: string, t: ReturnType<typeof useTranslations>) {
  if (typeof navigator === "undefined") return;
  navigator.clipboard
    ?.writeText(text)
    .then(() => {
      toast.success(t("linkCopied"));
    })
    .catch(() => {
      toast.error(t("linkCopyFailed"));
    });
}

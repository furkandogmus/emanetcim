"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { returnedErrorKey } from "@/lib/action-error";

/**
 * Bir server action'ın `error` alanını GÖSTERİLEBİLİR, yerelleştirilmiş metne çevirir.
 *
 * NEDEN VAR (2026-08-25'te ölçüldü): 10 ekran `toast.error(res.error)` yazıyordu ve
 * action'lar oraya üç ayrı biçim gönderiyordu — çeviri anahtarı
 * (`"Errors.bookingNotFound"`), snake_case kod (`"tracking_number_required"`) ve
 * servisin Türkçe cümlesi. Üçü de kullanıcının ekranına HAM düşüyordu:
 * rezervasyonunu iptal edemeyen bir misafir "Errors.bookingNotFound" okuyordu.
 *
 * Kural: tanınan bir anahtar varsa çevirisi, yoksa çağıranın verdiği bağlama özel
 * yedek metin, o da yoksa `Errors.generic`. Ham metin hiçbir yoldan geçmez.
 *
 * Ayrıştırma mantığı `returnedErrorKey`'de ve saf — `action-error.test.ts` onu
 * doğrudan sınar; buradaki iş yalnızca çeviriye bağlamak.
 */
export function useActionErrorText() {
  const t = useTranslations("Errors");

  return useCallback(
    (raw: string | null | undefined, fallback?: string): string => {
      const key = returnedErrorKey(raw);
      /*
        `t.has` şart: eşlemede olup sözlükte karşılığı olmayan bir anahtar
        `t()` çağrısında anahtarın kendisini basardı — düzeltmeye çalıştığımız
        hatanın aynısı. Sözlükte yoksa yedek metne düşer.
      */
      if (key && t.has(key)) return t(key as never);
      return fallback ?? t("generic");
    },
    [t],
  );
}

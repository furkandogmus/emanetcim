"use client";

import { useEffect, useRef } from "react";

/**
 * Bir modalın klavye ve odak davranışı — tek yerde.
 *
 * NEDEN VAR (2026-08-22 taraması): kod tabanındaki **hiçbir** modal Escape tuşunu
 * desteklemiyordu ve çoğunda `role="dialog"` yoktu. En kritik olanı
 * `ConfirmDialog`'du: her yıkıcı onayda kullanılan bileşen, klavye kullanıcısının
 * kapatamadığı bir kutu açıyordu. Ekran okuyucuya da bunun bir iletişim kutusu
 * olduğu söylenmiyordu.
 *
 * Kalıp kod tabanında zaten vardı (`DateTimePicker` Escape'i işliyor); eksik olan
 * onu paylaşılan bir yere almaktı.
 *
 * Üç şey yapar:
 *  1. **Escape kapatır.** Klavye kullanıcısının çıkış yolu.
 *  2. **Arka plan kaydırması kilitlenir.** Mobilde modal açıkken arkadaki sayfanın
 *     kayması, kullanıcının yerini kaybetmesine yol açar.
 *  3. **Odak geri verilir.** Modal kapanınca odak, onu açan öğeye döner; aksi halde
 *     klavye kullanıcısı sayfanın başına düşer.
 */
export function useModalBehavior({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    /**
     * Önceki değeri saklayıp geri koyuyoruz: iç içe iki modal açıldığında
     * içteki kapanınca dıştakinin kilidi bozulmamalı.
     */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);
}

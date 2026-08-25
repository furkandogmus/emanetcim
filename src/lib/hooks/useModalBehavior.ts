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
 * Beş şey yapar:
 *  1. **Escape kapatır.** Klavye kullanıcısının çıkış yolu.
 *  2. **Arka plan kaydırması kilitlenir.** Mobilde modal açıkken arkadaki sayfanın
 *     kayması, kullanıcının yerini kaybetmesine yol açar.
 *  3. **Odak geri verilir.** Modal kapanınca odak, onu açan öğeye döner; aksi halde
 *     klavye kullanıcısı sayfanın başına düşer.
 *  4. **Tab, modal içinde döner (focus trap).** Aksi halde Tab'a basmaya devam eden
 *     klavye kullanıcısı arka plandaki (görsel olarak kapalı ama DOM'da hâlâ
 *     odaklanabilir) içeriğe geçer — modal açık göründüğü halde odak kaybolur.
 *     Ref almadan çalışması için DOM'daki en son `[role="dialog"]` öğesi baz
 *     alınır (iç içe modallarda en üstteki); hook zaten Escape/scroll-kilidi
 *     için de ref istemiyordu.
 *  5. **Açılışta odak modala taşınır.** `ConfirmDialog` gibi kendi odak hedefini
 *     seçen bileşenler ayrıca kendi `useEffect`'iyle üzerine yazabilir (bu hook
 *     önce çalışır); ama `CheckoutSealsDialog` / galeri lightbox'ı gibi özel
 *     mantığı olmayanlarda odak, tetikleyen düğmede (artık arka planda, görsel
 *     olarak erişilemez) kalıyordu — Tab'a basana kadar modal açılmamış gibi
 *     davranıyordu.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
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
        return;
      }
      if (e.key !== "Tab") return;

      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      const dialog = dialogs[dialogs.length - 1];
      if (!dialog) return;

      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const dialogsOnOpen = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    const dialogOnOpen = dialogsOnOpen[dialogsOnOpen.length - 1];
    if (dialogOnOpen && !dialogOnOpen.contains(document.activeElement)) {
      const firstFocusable = dialogOnOpen.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    }

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

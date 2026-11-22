"use client";

import { useEffect, useRef, type RefObject } from "react";
import { isTopModal, modalNode, popModal, pushModal, setModalNode } from "@/lib/modal-inert";

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
 * Altı şey yapar:
 *  1. **Escape kapatır.** Klavye kullanıcısının çıkış yolu.
 *  2. **Arka plan kaydırması kilitlenir.** Mobilde modal açıkken arkadaki sayfanın
 *     kayması, kullanıcının yerini kaybetmesine yol açar.
 *  3. **Odak geri verilir.** Modal kapanınca odak, onu açan öğeye döner; aksi halde
 *     klavye kullanıcısı sayfanın başına düşer.
 *  4. **Tab, modal içinde döner (focus trap).** Aksi halde Tab'a basmaya devam eden
 *     klavye kullanıcısı arka plandaki (görsel olarak kapalı ama DOM'da hâlâ
 *     odaklanabilir) içeriğe geçer — modal açık göründüğü halde odak kaybolur.
 *     Tuzak, çağıranın `ref` ile verdiği modal kökünün içinde kurulur.
 *  5. **Açılışta odak modala taşınır.** `ConfirmDialog` gibi kendi odak hedefini
 *     seçen bileşenler ayrıca kendi `useEffect`'iyle üzerine yazabilir (bu hook
 *     önce çalışır); ama `CheckoutSealsDialog` / galeri lightbox'ı gibi özel
 *     mantığı olmayanlarda odak, tetikleyen düğmede (artık arka planda, görsel
 *     olarak erişilemez) kalıyordu — Tab'a basana kadar modal açılmamış gibi
 *     davranıyordu.
 *  6. **Arka plan `inert` olur** (`src/lib/modal-inert.ts`): ekran okuyucunun
 *     sanal imleci de modaldan çıkamaz. İç içe modallarda Escape/Tab yalnızca
 *     en üsttekinde çalışır; eskiden Escape ikisini birden kapatıyordu.
 *     Açılır pencereler (`DateTimePicker`) `inertBackground: false` verir.
 *
 * `ref` ZORUNLU ve modalın en dış kökünü (karartma dahil) göstermeli. Kök
 * DOM'dan tahmin EDİLMEZ (2026-11-23): `[role="dialog"]` aramak, sayfadaki
 * modal olmayan bir şeridi ya da kapalı bir `BottomSheet`i kök seçiyor ve
 * modalın kendisini `inert` yapıyordu. Ref ilk render'da boş olabilir (takvim
 * bir sonraki render'da çiziliyor); kilit ve açılış odağı ref bağlanınca kurulur.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function useModalBehavior({
  open,
  onClose,
  ref,
  inertBackground = true,
}: {
  open: boolean;
  onClose: () => void;
  ref: RefObject<HTMLElement | null>;
  inertBackground?: boolean;
}): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const modalIdRef = useRef<number | null>(null);
  /**
   * `onClose` cogu cagirandan INLINE bir fonksiyon olarak geliyor (ornek:
   * `ConfirmDialog`'un `onCancel={() => setX(null)}`). Bagimlilikta olsaydi
   * modal acikken ilgisiz her yeniden render efekti sokup kurar, odak
   * tetikleyiciye gidip geri gelirdi; yazilan alanda imlec kayboluyordu.
   */
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const modalId = pushModal({ node: null, inert: inertBackground });
    modalIdRef.current = modalId;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTopModal(modalId)) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const root = modalNode(modalId);
      if (!root) return;

      const focusable = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
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

    /**
     * Önceki değeri saklayıp geri koyuyoruz: iç içe iki modal açıldığında
     * içteki kapanınca dıştakinin kilidi bozulmamalı.
     */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      modalIdRef.current = null;
      // SIRA ONEMLI: `inert` once kalkmali; `inert` icindeki acici odak alamaz.
      popModal(modalId);
      previouslyFocused.current?.focus?.();
    };
    // `onClose` bilerek burada degil -- yukaridaki `onCloseRef`e bakin.
  }, [open, inertBackground]);

  /**
   * Her render'dan sonra kök düğümü eşitler: ilk bağlanışta (gecikmeli
   * çizilen takvim dahil) kilidi kurar ve odağı içeri taşır; remount'ta
   * düğümü günceller ki Escape/Tab ve `inert` aynı düğüme baksın.
   */
  useEffect(() => {
    const id = modalIdRef.current;
    if (id === null) return;
    const node = ref.current;
    const prev = modalNode(id);
    if (node === prev) return;
    setModalNode(id, node);
    if (!prev && node && !node.contains(document.activeElement)) {
      node.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    }
  });
}

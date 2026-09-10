"use client";

import { useEffect, useRef, useState } from "react";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * En yıkıcı eylemler için ek engel: kullanıcı `phrase`'i harfiyen yazmadan
   * onay butonu etkinleşmez (hesap kapatma gibi geri alınamaz işlemler için).
   * Verilmezse davranış öncekiyle birebir aynı kalır.
   */
  typedConfirmation?: {
    phrase: string;
    label: string;
  };
};

/**
 * Yıkıcı işlemlerin onay kutusu.
 *
 * ERİŞİLEBİLİRLİK (2026-08-22'de eklendi): bu bileşen kod tabanındaki her yıkıcı
 * onayda kullanılıyor ama `role="dialog"` taşımıyordu, Escape ile kapanmıyordu ve
 * odak yönetimi yoktu. Yani klavye kullanıcısı, kapatamadığı bir kutunun içinde
 * kalıyordu — üstelik en dikkat gerektiren anda.
 *
 * VARSAYILAN ODAK **İPTAL** BUTONUNDA: bir onay kutusu açıldığında Enter'a basmak
 * yıkıcı eylemi tetiklememelidir.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  typedConfirmation,
}: ConfirmDialogProps) {
  useModalBehavior({ open, onClose: onCancel });

  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  /*
    Her acilista sifirlanir: onceki calistirmada yazilmis ifade bir sonraki
    acilista kalirsa (ozellikle ayni sayfada tekrar tetiklenen bir onay
    kutusunda) onay butonu misafirin hicbir sey yazmadigi bir acilista bile
    etkin gorunur -- tam korumak istedigimiz seyin karsiti.

    `useEffect` DEGIL, render sirasinda ayarlama: React'in kendi onerdigi
    "prop degisince state sifirla" kalibi (react-hooks/set-state-in-effect
    tam bu yuzden bir efekt icinde senkron `setState`i reddediyor -- ekstra
    bir render turu ve olasi kirpisma demek).
  */
  const [typed, setTyped] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTyped("");
  }

  if (!open) return null;

  /*
    TAM (buyuk/kucuk harf DUYARLI) ESLESME -- kasitli. `toLocaleUpperCase()`
    ile yumusatma denendi ama Turkce "i" -> varsayilan (Turkce olmayan) yerel
    ayarda "I" (noktasiz) degil "İ" (noktali) olmasi gerekirken tam tersini
    uretiyor, yani kullanici gosterilen ifadeyi harfiyen yazsa bile eslesme
    bazen basarisiz oluyordu. Ifade zaten ekranda TAM yazilisiyla goruluyor
    (placeholder), kopyalanabilir/okunabilir -- tam eslesme istemek yerel
    ayar tuzagina girmeden ayni amaca hizmet ediyor.
  */
  const confirmationSatisfied =
    !typedConfirmation || typed.trim() === typedConfirmation.phrase.trim();

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
      // Dışarı tıklamak da iptaldir; onaylamak her zaman bilinçli olmalı.
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "confirm-dialog-title" : undefined}
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
        className="ui-card w-full max-w-sm p-6 flex flex-col gap-4"
      >
        {title ? (
          <h3 id="confirm-dialog-title" className="ui-heading-md">
            {title}
          </h3>
        ) : null}
        <p id="confirm-dialog-message" className="ui-body-sm text-gray-700">
          {message}
        </p>
        {typedConfirmation ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-gray-600">
              {typedConfirmation.label}
            </span>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={typedConfirmation.phrase}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold tracking-wide text-gray-900 outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </label>
        ) : null}
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="btn-ui btn-ui-md btn-ui-ghost flex-1"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!confirmationSatisfied}
            className="btn-ui btn-ui-md btn-ui-primary flex-1"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

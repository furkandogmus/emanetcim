"use client";

import { useEffect, useRef } from "react";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
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
}: ConfirmDialogProps) {
  useModalBehavior({ open, onClose: onCancel });

  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

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
            className="btn-ui btn-ui-md btn-ui-primary flex-1"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

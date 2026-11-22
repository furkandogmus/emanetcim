"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

/** Bir alanın hata metninin DOM kimliği; `aria-describedby` buna bağlanır. */
export function fieldErrorId(formId: string, field: string): string {
  return `${formId}-${field}-error`;
}

/**
 * Alan düzeyinde hata durumu: geçersiz alan `aria-invalid` + kendi hata
 * metnine `aria-describedby` taşır, başarısız gönderimde odak ilk geçersiz
 * alana gider. Form düzeyindeki `role="alert"` özeti yerinde kalır; bu onu
 * tamamlar (ekran okuyucu hangi alanın yanlış olduğunu alanın kendisinde duyar).
 *
 * Odak sırası DOM sırasıdır (`attachForm` verilen öğedeki ilk `[aria-invalid="true"]`),
 * yani çağıranın alan listesi tutması gerekmez.
 */
export function useFieldErrors<F extends string>(formId: string) {
  const formNode = useRef<HTMLElement | null>(null);
  /*
    Ref NESNESI degil geri cagirim dondurulur: React Compiler, ref tasiyan bir
    nesnenin alanlarini render'da okumayi (`errors`, `fieldProps`) ref erisimi sayar.
  */
  const attachForm = useCallback((node: HTMLElement | null) => {
    formNode.current = node;
  }, []);
  const [errors, setErrorsState] = useState<FieldErrors<F>>({});
  const [focusRequest, setFocusRequest] = useState(0);

  useEffect(() => {
    if (focusRequest === 0) return;
    const first = formNode.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus();
  }, [focusRequest]);

  /** Hataları yazar; en az bir hata varsa ilk geçersiz alana odaklanır. */
  const setErrors = useCallback((next: FieldErrors<F>) => {
    setErrorsState(next);
    if (Object.values(next).some(Boolean)) setFocusRequest((n) => n + 1);
  }, []);

  const clearError = useCallback((field: F) => {
    setErrorsState((prev) => {
      if (!prev[field]) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  }, []);

  /** Girdiye yayılacak ARIA öznitelikleri. `describedBy` ek ipucu kimlikleridir. */
  const fieldProps = (field: F, describedBy?: string) => {
    const hasError = Boolean(errors[field]);
    const ids = [describedBy, hasError ? fieldErrorId(formId, field) : undefined]
      .filter(Boolean)
      .join(" ");
    return {
      "aria-invalid": hasError ? (true as const) : undefined,
      "aria-describedby": ids || undefined,
    };
  };

  return {
    attachForm,
    errors,
    setErrors,
    clearError,
    fieldProps,
    errorId: (field: F) => fieldErrorId(formId, field),
  };
}

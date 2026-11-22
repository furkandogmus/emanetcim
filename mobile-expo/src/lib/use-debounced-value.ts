import { useEffect, useState } from "react";

/**
 * Degeri, `delayMs` boyunca degismedikten sonra verir. Her tusta istek atilmasin diye;
 * bos degere donus (kutuyu temizleme) beklemeden uygulanir, liste hemen geri gelsin.
 */
export function useDebouncedValue<T>(value: T, delayMs: number, isEmpty: (v: T) => boolean = (v) => !v): T {
  const [debounced, setDebounced] = useState(value);
  const empty = isEmpty(value);
  useEffect(() => {
    // Bos deger zaten aninda donuyor; saklanan da sifirlanir ki sonraki terim eskisini bir an tetiklemesin.
    const id = setTimeout(() => setDebounced(value), empty ? 0 : delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs, empty]);
  return empty ? value : debounced;
}

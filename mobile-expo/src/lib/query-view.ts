/**
 * React Query v5'te arka plan yenilemesi (30 sn'lik poll, pull-to-refresh) basarisiz olunca
 * `isError` true olur AMA `data` korunur. Ekranlar `isError ? hataEkrani : liste` yazinca
 * zayif Wi-Fi'da her ses kesintisi dolu listeyi siliyordu. Kural tek yerde:
 *  - hata ekrani yalnizca gosterilecek veri YOKKEN (`isBlockingError`),
 *  - veri varken hata sadece ince bir bant (`isStaleError`, `StaleQueryBanner`).
 */
import { ApiError } from "./api";

export interface QueryViewState {
  isError: boolean;
  data: unknown;
  error?: unknown;
}

/**
 * Yalnizca ag/sunucu hatasi gecicidir. 404/403 kalicidir: kayit silinmis ya da erisim
 * bitmistir; eski veriyi "baglanti yok" diye tutmak, yok olmus rezervasyonda teslim
 * dugmelerini acik birakirdi.
 */
function isTransient(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
}

/** Gosterilecek veri yok ya da hata kalici: tam ekran hata. */
export function isBlockingError(q: QueryViewState): boolean {
  return q.isError && (q.data == null || !isTransient(q.error));
}

/** Gecici yenileme hatasi, onbellekteki veri duruyor: veriyi goster, ustune bant koy. */
export function isStaleError(q: QueryViewState): boolean {
  return q.isError && q.data != null && isTransient(q.error);
}

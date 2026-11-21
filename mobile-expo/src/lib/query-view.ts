/**
 * React Query v5'te arka plan yenilemesi (30 sn'lik poll, pull-to-refresh) basarisiz olunca
 * `isError` true olur AMA `data` korunur. Ekranlar `isError ? hataEkrani : liste` yazinca
 * zayif Wi-Fi'da her ses kesintisi dolu listeyi siliyordu. Kural tek yerde:
 *  - hata ekrani yalnizca gosterilecek veri YOKKEN (`isBlockingError`),
 *  - veri varken hata sadece ince bir bant (`isStaleError`, `StaleQueryBanner`).
 */
export interface QueryViewState {
  isError: boolean;
  data: unknown;
}

/** Ilk yukleme basarisiz, elde gosterilecek veri yok: tam ekran hata. */
export function isBlockingError(q: QueryViewState): boolean {
  return q.isError && q.data == null;
}

/** Yenileme basarisiz ama onbellekteki veri duruyor: veriyi goster, ustune bant koy. */
export function isStaleError(q: QueryViewState): boolean {
  return q.isError && q.data != null;
}

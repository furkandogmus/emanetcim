/**
 * Giris yapmadan gezen misafir "Rezervasyon yap"a basinca giris ekranina gider.
 * Giris bitince ayni dukkanin odeme ekranina devam etsin diye niyet burada
 * tutulur (surec ici; uygulama kapanirsa kaybolmasi sorun degil).
 */
let pendingCheckoutShopId: string | null = null;

export function rememberCheckoutIntent(shopId: string) {
  pendingCheckoutShopId = shopId;
}

/** Bir kez okunur: ayni niyet ikinci kez yonlendirmez. */
export function takeCheckoutIntent(shopId: string): boolean {
  if (pendingCheckoutShopId !== shopId) return false;
  pendingCheckoutShopId = null;
  return true;
}

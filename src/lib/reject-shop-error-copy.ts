/**
 * `rejectShopAction` başarısızlıkta ham metin değil `"Errors.x"` anahtarı
 * döner (bkz. `src/services/ShopService.ts::rejectPendingShop`). Çevirmeden
 * `toast.error(result.error)` ile gösterilseydi Türkçe dışındaki 5 dilde de
 * birebir Türkçe metin (örn. "Dükkan bulunamadı.") görünürdü.
 */
const KNOWN_REJECT_SHOP_ERROR_KEYS = new Set([
  "shopNotFound",
  "shopAlreadyApproved",
  "shopHasBookings",
  "generic",
]);

/** `Errors` namespace'i içindeki anahtar — `useTranslations("Errors")` ile kullanılır. */
export function rejectShopErrorKey(raw: string | undefined): string {
  const bare = raw?.startsWith("Errors.") ? raw.slice("Errors.".length) : raw;
  return bare && KNOWN_REJECT_SHOP_ERROR_KEYS.has(bare) ? bare : "generic";
}

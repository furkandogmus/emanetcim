/**
 * `createDisputeAction` başarısızlıkta ham metin değil `"Errors.x"` anahtarı
 * döner (bkz. `src/actions/dispute.ts`) — kırpılmadan gitmesi gereken tek yol
 * bu. `DisputeForm.tsx` bunu çevirmeden gösterirse ekranda birebir
 * "Errors.duplicateDispute" gibi bir anahtar yazardı; bkz. `action-error.ts`'teki
 * aynı sınıf düzeltme.
 */
const KNOWN_ERROR_KEYS = new Set([
  "authRequired",
  "unauthorized",
  "disputeNotReady",
  "duplicateDispute",
]);

/** `Errors` namespace'i içindeki anahtar — `useTranslations("Errors")` ile kullanılır. */
export function disputeErrorKey(raw: string): string {
  const bare = raw.startsWith("Errors.") ? raw.slice("Errors.".length) : raw;
  return KNOWN_ERROR_KEYS.has(bare) ? bare : "generic";
}

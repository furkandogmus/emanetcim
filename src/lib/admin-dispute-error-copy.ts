/**
 * `updateDisputeStatusAction` başarısızlıkta ham metin değil `"Errors.x"`
 * anahtarı döner (bkz. `src/actions/dispute.ts`). `AdminDisputesClient.tsx`
 * bunu çevirmeden `t("disputesToastError", { error: res.error })` içine
 * koysaydı toast'ta birebir "Hata: Errors.unauthorized" yazardı; bkz.
 * `dispute-error-copy.ts`'teki misafir tarafındaki aynı sınıf düzeltme.
 */
const KNOWN_DISPUTE_ERROR_KEYS = new Set(["unauthorized", "invalidData"]);

/** `Errors` namespace'i içindeki anahtar — `useTranslations("Errors")` ile kullanılır. */
export function adminDisputeErrorKey(raw: string): string {
  const bare = raw.startsWith("Errors.") ? raw.slice("Errors.".length) : raw;
  return KNOWN_DISPUTE_ERROR_KEYS.has(bare) ? bare : "generic";
}

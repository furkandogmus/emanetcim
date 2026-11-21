/**
 * Tekrar-deneme anahtari: ayni onay denemesi icin ayni deger gider, sunucu
 * (`Idempotency-Key`) ikinci rezervasyon acmaz. Sunucu bicimi: [A-Za-z0-9_-]{8,80}.
 */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Hermes'te randomUUID yoksa: zaman + rastgele, cakisma olasiligi ihmal edilebilir.
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}${rand()}`;
}

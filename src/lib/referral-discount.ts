/**
 * Referans indiriminin aritmetigi -- sunucu (`ReferralService`) ve web odeme
 * ekranindaki onizleme AYNI fonksiyonu kullanir, gosterilen tutar kesilenle
 * ayrismasin diye. Indirim, sigorta dahil ara toplamdan (kupon oncesi) alinir.
 */
export function applyReferralDiscount(
  subtotal: number,
  discountPct: number,
): { discountAmount: number; totalPrice: number } {
  const discountAmount = Math.round(subtotal * (discountPct / 100) * 100) / 100;
  const totalPrice = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  return { discountAmount, totalPrice };
}

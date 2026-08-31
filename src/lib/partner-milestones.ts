/**
 * Esnafın bir sonraki kilometre taşı — SAF hesap.
 *
 * Bileşenden ayrı duruyor: `PartnerPulse` `next-intl`in istemci yönlendirmesini
 * çekiyor ve bu, node test ortamında modül çözümlemesini kırıyor. Kural zaten
 * bir görsel karar değil, sınanabilir bir eşik tablosu.
 */

/**
 * Eşikler SEYREKLEŞEREK büyür: 10, 25, 50, 100…
 *
 * Sabit aralık (her 100'de bir) yeni başlayan esnafa ilk günden ulaşılamayacak
 * bir hedef gösterir; motive etmesi gereken şey caydırıcı olur.
 */
export const BAG_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const;

export function nextMilestone(
  handled: number,
): { target: number; pct: number } | null {
  const target = BAG_MILESTONES.find((m) => m > handled);
  // Son esigi de gecen esnafa hedef gostermek anlamsiz; blok gizlenir.
  if (target === undefined) return null;
  return { target, pct: Math.min(100, Math.round((handled / target) * 100)) };
}

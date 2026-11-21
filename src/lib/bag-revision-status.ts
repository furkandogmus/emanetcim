/**
 * Valiz duzeltmesine izin verilen rezervasyon durumlari -- TEK KAYNAK.
 *
 * Servis (`services/booking/bag-revision.ts`) yazmayi bu listeyle kapatir; mobil
 * DTO bekleyen oneriyi AYNI listeyle gizler. Iki ayri liste ayrisinca misafir
 * onaylayamayacagi bir Onayla/Reddet karti goruyordu (bulgu 57).
 */
export const BAG_REVISABLE_STATUSES = ["APPROVED", "PAID", "CHECKED_IN"] as const;

export function isBagRevisableStatus(status: string): boolean {
  return (BAG_REVISABLE_STATUSES as readonly string[]).includes(status);
}

import { Prisma } from "@prisma/client";

/**
 * ESNAF KAZANCI TESLIM (CHECK-OUT) ANINA GORE SAYILIR — tek kaynak.
 *
 * NEDEN (urun karari, 2026-11): "bu ay kazancin" olusturma tarihine, "bugun"
 * check-in anina, gecmis listesi yine olusturma tarihine bakiyordu. Ayin 30'unda
 * yapilip 1'inde tamamlanan emanet gecen aya yaziliyor, kasa uygulamayla hic
 * tutmuyordu. Hizmet valiz misafire geri verildiginde tamamlanir; panel, mobil
 * ve web kazanc ekranlari bu yuzden yalnizca TESLIM EDILMIS emanetleri, teslim
 * anina gore sayar ("Teslim edilen emanetler").
 *
 * `checkedOutAt` sonradan eklendi (P1-10); bos olan eski satirlar planlanan
 * cikis saatine (`checkOutTime`) duser ki gecmis aylar bosalmasin.
 */
export const COLLECTED_BOOKING_STATUS = "CHECKED_OUT" as const;

export type CollectionRange = { start: Date; end?: Date };

/** Teslim edilmis ve (aralik verildiyse) teslim ani araliga dusen rezervasyonlar. */
export function collectedEarningsWhere(range?: CollectionRange): Prisma.BookingWhereInput {
  if (!range) return { status: COLLECTED_BOOKING_STATUS };
  const window = { gte: range.start, ...(range.end ? { lt: range.end } : {}) };
  return {
    status: COLLECTED_BOOKING_STATUS,
    OR: [{ checkedOutAt: window }, { checkedOutAt: null, checkOutTime: window }],
  };
}

/** En son teslim edilen once. */
export const COLLECTED_ORDER_BY: Prisma.BookingOrderByWithRelationInput[] = [
  { checkedOutAt: { sort: "desc", nulls: "last" } },
  { checkOutTime: "desc" },
];

/** Ham SQL toplamalari icin ayni an. */
export const COLLECTED_AT_SQL = Prisma.sql`COALESCE("checkedOutAt", "checkOutTime")`;

/** Bir satirin teslim (tahsilat) ani. */
export function collectedAt(b: { checkedOutAt: Date | null; checkOutTime: Date }): Date {
  return b.checkedOutAt ?? b.checkOutTime;
}

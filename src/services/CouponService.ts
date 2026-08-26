/**
 * Kupon kotasi ve indirim hesabi.
 *
 * NEDEN SERVIS (2026-08-25): kupon PARA demektir — indirim tutari rezervasyonun
 * `totalPrice`'ini dogrudan degistirir. `createBookingAction` bunu ham
 * `prisma.coupon.updateMany` / `update` ile yapiyordu, yani CLAUDE.md'nin
 * "yazma islemleri yalnizca `src/services/`" kurali para yolunda deliniyordu.
 *
 * Ayrica kota alma mantigi iki dala bolunmustu (`maxUses` var / yok) ve
 * "hak al" ile "indirimi hesapla" ayni blokta ic ice gecmisti; ikincisi
 * digerinden bagimsiz olarak test edilemiyordu. Burada ikisi ayri:
 * `claimCoupon` yalnizca kotayi ve uygunlugu, `applyDiscount` yalnizca aritmetigi.
 */
import prisma from '@/lib/db';
import logger from '@/lib/logger';
import { moneyToNumber } from '@/lib/money';

export type ClaimedCoupon = {
  couponId: string;
  /** Kupon uygulandiktan SONRAKI tutar. */
  totalPrice: number;
};

export type CouponClaimResult =
  | { ok: true; claimed: ClaimedCoupon }
  /**
   * Kupon yok, suresi gecmis, pasif, alt limitin altinda ya da kotasi dolmus.
   * HEPSI ayni sonuca cikar: indirim uygulanmaz ve rezervasyon TAM fiyatla devam
   * eder. Bu bilerek bir hata degil — kotanin son hakkini kaybeden bir misafirin
   * rezervasyonu bu yuzden basarisiz olmamali.
   */
  | { ok: false };

/** Yuzde/sabit indirim aritmetigi. Negatife dusmez. */
export function applyDiscount(
  totalPrice: number,
  discount: number,
  isPercent: boolean,
): number {
  const next = isPercent
    ? totalPrice * (1 - discount / 100)
    : totalPrice - discount;
  return Math.max(0, Math.round(next * 100) / 100);
}

/**
 * Kupon hakkini ATOMIK olarak alir ve indirimli tutari doner.
 *
 * Hak, rezervasyon olusmadan ONCE alinir: yaris kosulunda (es zamanli istekler
 * kotanin sinirinda) `updateMany` kosulu tutmaz ve indirim hic uygulanmaz.
 * Rezervasyon olusmazsa cagiran `releaseCoupon` ile hakki geri verir.
 */
export async function claimCoupon(
  code: string,
  totalPrice: number,
): Promise<CouponClaimResult> {
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return { ok: false };

  const now = new Date();
  const eligible =
    coupon.isActive &&
    (!coupon.expiresAt || coupon.expiresAt > now) &&
    (coupon.minPrice == null || totalPrice >= moneyToNumber(coupon.minPrice));
  if (!eligible) return { ok: false };

  /*
    Kotasiz kupon da sayaci artirir — kac kez kullanildigi raporlanabilir olmali.
    Tek fark, kotasizda kosul yok: `updateMany` her zaman eslesir. Eskiden bu iki
    hal ayri dallardaydi ve kotasiz dal ONCE "hak alindi" sayip SONRA artiriyordu.
  */
  const { count } = await prisma.coupon.updateMany({
    where: {
      id: coupon.id,
      ...(coupon.maxUses == null ? {} : { usedCount: { lt: coupon.maxUses } }),
    },
    data: { usedCount: { increment: 1 } },
  });
  if (count === 0) return { ok: false };

  return {
    ok: true,
    claimed: {
      couponId: coupon.id,
      totalPrice: applyDiscount(totalPrice, moneyToNumber(coupon.discount), coupon.isPercent),
    },
  };
}

/**
 * Alinmis kupon hakkini geri verir (rezervasyon olusturulamadi).
 * Basarisizligi cagirani ETKILEMEZ: rezervasyon zaten olusmadi, burada yapilacak
 * tek dogru sey sayacin sapmasini loglamak.
 */
export async function releaseCoupon(couponId: string): Promise<void> {
  await prisma.coupon
    .update({ where: { id: couponId }, data: { usedCount: { decrement: 1 } } })
    .catch((err) => logger.error({ err, couponId }, 'coupon_claim_release_failed'));
}

export class CouponService {
  claim(code: string, totalPrice: number): Promise<CouponClaimResult> {
    return claimCoupon(code, totalPrice);
  }

  release(couponId: string): Promise<void> {
    return releaseCoupon(couponId);
  }
}

export const couponService = new CouponService();

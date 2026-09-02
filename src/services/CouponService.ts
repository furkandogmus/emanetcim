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
import { Prisma } from '@prisma/client';
import logger from '@/lib/logger';
import { moneyToNumber } from '@/lib/money';

export type ClaimedCoupon = {
  couponId: string;
  /** Kupon uygulandiktan SONRAKI tutar. */
  totalPrice: number;
  /**
   * Uygulanan kupon kodu ve indirim TUTARI -- deftere yazilmak icin.
   *
   * NEDEN EKLENDI (2026-09-01): servis yalnizca indirilmis tutari donduruyordu.
   * Cagiran onu `totalPrice`a yaziyor ve indirimin kendisi hicbir yere
   * kaydedilmiyordu; `couponId` de yalnizca hata halinde kotayi geri vermek
   * icin bellekte tutuluyordu. "Bu rezervasyon neden 50 degil de 40 TRY?"
   * sorusunun cevabi VERIDE YOKTU -- oysa referans indirimi ta bastan
   * kaydediliyordu.
   */
  code: string;
  discountAmount: number;
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
  /*
    GIRDI DE KURUSA CEKILIYOR (2026-09-01'de olculdu).

    Onceden yalnizca SONUC yuvarlaniyordu. Kurus alti bir girdi geldiginde
    (`120.005`) sonuc ile "girdi eksi sonuc" toplami asil fiyati TUTMUYORDU:
    indirim 96,00 ve fark 24,00 cikiyor, toplam 120,00 -- oysa fiyatin kurusa
    yuvarlanmisi 120,01. Deftere bir kurusluk acik olarak giriyordu.

    `Booking.totalPrice` zaten `Decimal(12,2)`: kurus alti bir deger yazilirken
    veritabani onu yuvarliyor, yani servisin dondurdugu sayi ile deftere giren
    sayi ayrisiyordu. Para fonksiyonu kendi icinde tutarli olmali --
    `platform-split.ts`teki ayni gerekce.
  */
  /*
    INDIRIM ASLA FIYATI ARTIRMAZ (2026-09-02'de gercek veritabaninda olculdu).

    Negatif bir `discount` ile bu fonksiyon fiyati YUKSELTIYORDU:

        applyDiscount(240, -50, false) = 290
        gercek kupon: totalPrice 290, discountAmount -50

    Yani misafir "indirim kuponu" girip elli lira FAZLA oduyordu ve deftere
    negatif bir indirim yaziliyordu. Admin action zaten `z.number().positive()`
    ile doguruyor -- ama bu fonksiyon veritabanindan gelen bir degeri isliyor:
    elle yazilmis bir satir, bir bakim scripti ya da eski bir kayit yeter.
    Aritmetigin kendisi guvenli olmali.

    Yuzde de 100'de tavanlanir: %500 indirim zaten sifira iniyordu
    (`Math.max(0, ...)`), ama tavan niyeti acikca yaziyor.
  */
  const indirim = Math.max(0, discount);
  const base = Math.round(totalPrice * 100) / 100;
  const next = isPercent
    ? base * (1 - Math.min(100, indirim) / 100)
    : base - indirim;
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

  const discounted = applyDiscount(
    totalPrice,
    moneyToNumber(coupon.discount),
    coupon.isPercent,
  );
  return {
    ok: true,
    claimed: {
      couponId: coupon.id,
      totalPrice: discounted,
      code: coupon.code,
      /*
        FARKTAN hesaplaniyor, orandan yeniden turetilmiyor: `applyDiscount`in
        yuvarlamasi neyse indirim de o. Ikisini ayri hesaplamak, defterde
        `totalPrice + indirim != asil fiyat` gibi bir kurus acigi birakirdi --
        `platform-split.ts`teki ayni gerekce.
      */
      discountAmount:
        Math.round((Math.round(totalPrice * 100) / 100 - discounted) * 100) / 100,
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

/** Kupon kodu her yerde AYNI biçimde saklanır: boşluksuz, büyük harf. */
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export type CouponInput = {
  code: string;
  discount: number;
  isPercent: boolean;
  minPrice: number | null;
  /** `null` = sinirsiz kullanim. */
  maxUses: number | null;
  expiresAt: Date | null;
};

export type CouponCreateResult =
  | { ok: true; id: string; code: string }
  /* `invalid_input`: indirim/kota degerleri anlamsiz -- gerekce `createCoupon`da. */
  | { ok: false; reason: 'duplicate_code' | 'invalid_input' };

/**
 * Yeni kupon uretir.
 *
 * NEDEN SERVISTE: `Coupon` para yolundaki modellerden biri ve CLAUDE.md'nin
 * `service-layer-writes` mandali bu tabloya servis disindan yazmayi KESIN
 * yasakliyor. Admin ekrani da bu kurala tabi -- 2026-08-30'a kadar kupon
 * uretecek hicbir ekran yoktu ve kuponlar ancak veritabanina elle satir
 * atilarak dogabiliyordu.
 *
 * Kod tekilligini veritabani zorluyor (`@unique`); onceden `findUnique` ile
 * bakip sonra yazmak, iki es zamanli istekte ikisinin de "musait" gormesi
 * demekti. Cakismayi P2002 uzerinden yakalamak yarissiz tek yoldur.
 */
export async function createCoupon(input: CouponInput): Promise<CouponCreateResult> {
  /*
    SERVIS SEVIYESINDE GIRDI KAPISI (2026-09-02'de olculdu).

    Servis dogrudan cagrildiginda su kuponlar KAYDA GIRIYORDU:

        %500 indirim      -> kaydedildi (tutari sifira indiriyor)
        -50 TL indirim    -> kaydedildi ve FIYATI ARTIRIYORDU
        maxUses: -1       -> kaydedildi, kupon hic kullanilamaz (sessiz olu)
        minPrice: -100    -> kaydedildi

    Admin action zaten doguruyor (`discount: z.number().positive()`,
    `maxUses: min(1)`, `minPrice: min(0)`) -- ama CLAUDE.md "yazma islemleri
    yalnizca `src/services/` uzerinden" diyor ve son savunma hatti orasi
    olmali. Ayni gerekceyle bu oturumda rezervasyon ve dukkan guncelleme
    kapilari da eklendi.
  */
  if (
    !Number.isFinite(input.discount) ||
    input.discount <= 0 ||
    (input.isPercent && input.discount > 100)
  ) {
    return { ok: false, reason: 'invalid_input' };
  }
  if (input.maxUses != null && (!Number.isInteger(input.maxUses) || input.maxUses < 1)) {
    return { ok: false, reason: 'invalid_input' };
  }
  if (input.minPrice != null && (!Number.isFinite(input.minPrice) || input.minPrice < 0)) {
    return { ok: false, reason: 'invalid_input' };
  }

  const code = normalizeCouponCode(input.code);
  try {
    const row = await prisma.coupon.create({
      data: {
        code,
        discount: input.discount,
        isPercent: input.isPercent,
        minPrice: input.minPrice,
        maxUses: input.maxUses,
        expiresAt: input.expiresAt,
        isActive: true,
      },
      select: { id: true, code: true },
    });
    return { ok: true, id: row.id, code: row.code };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, reason: 'duplicate_code' };
    }
    throw err;
  }
}

/**
 * Kuponu acar/kapatir.
 *
 * SILME YOK, BILEREK: kullanilmis bir kuponu silmek, o kuponla yapilmis
 * rezervasyonlarin indiriminin nereden geldigini yok eder. Kapatmak yeni
 * kullanimi durdurur ve gecmisi yerinde birakir.
 */
export async function setCouponActive(id: string, isActive: boolean): Promise<void> {
  await prisma.coupon.update({ where: { id }, data: { isActive } });
}

export class CouponService {
  claim(code: string, totalPrice: number): Promise<CouponClaimResult> {
    return claimCoupon(code, totalPrice);
  }

  release(couponId: string): Promise<void> {
    return releaseCoupon(couponId);
  }

  create(input: CouponInput): Promise<CouponCreateResult> {
    return createCoupon(input);
  }

  setActive(id: string, isActive: boolean): Promise<void> {
    return setCouponActive(id, isActive);
  }
}

export const couponService = new CouponService();

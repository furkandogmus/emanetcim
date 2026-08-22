import { Booking, Prisma } from '@prisma/client';
import prisma from '@/lib/db';

export type CreateInitialBookingInput = {
  guestId?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  shopId: string;
  totalPrice: number;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  checkInTime: Date;
  checkOutTime: Date;
  unitPrice?: number;
  insuranceFee?: number;
  referralDiscountAmount?: number;
  referredByCode?: string;
  /** Time-slot based: if provided, slot IDs to reserve instead of datetime pair */
  slotIds?: string[];
};

export type ModifyBookingInput = {
  checkInTime: Date;
  checkOutTime: Date;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
};

export type BookingWithGuestShop = Prisma.BookingGetPayload<{
  include: { guest: true; shop: true };
}>;


 export type GuestBookingListItem = Prisma.BookingGetPayload<{
  select: {
    id: true; guestId: true; shopId: true; checkInTime: true; checkOutTime: true;
    totalPrice: true; bagCountS: true; bagCountM: true; bagCountXl: true;
    status: true; qrCodeToken: true; createdAt: true;
    shop: { select: { name: true; address: true; pricePerDay: true } };
    dispute: { select: { id: true } };
  };
}>;

export type PartnerBookingListItem = Prisma.BookingGetPayload<{
  select: {
    id: true; checkInTime: true; checkOutTime: true;
    totalPrice: true; bagCountS: true; bagCountM: true; bagCountXl: true;
    status: true; createdAt: true;
    guest: { select: { name: true } };
  };
}>;
import { createQrToken } from '@/lib/qr-token';
import logger from '@/lib/logger';
import { isShopOpenAt } from '@/lib/shop-hours';
import { totalBagCount } from '@/lib/bag-pricing';
import { sealService, type SealAssignmentInput } from '@/services/SealService';
import { getPricingRules } from '@/lib/platform-settings';
import { toPricingSnapshot } from '@/lib/pricing-snapshot';
import { moneyToNumber } from '@/lib/money';
import { reserveSlots, releaseSlots } from '@/services/SlotService';
import {
  PartnerCheckInResult,
  PartnerCheckOutResult,
  CancelBookingResult,
  ModifyBookingResult,
  BookingWithShopGuestDetails,
} from '@/types/partner-booking';
import {
  computeAuthoritativeCheckoutTotals,
  validateBookingStayWindow,
} from '@/lib/booking-server-price';
import { bookingEventService } from '@/services/BookingEventService';
import { paymentService, type PaymentActor } from '@/services/PaymentService';

type TxClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
>;

export class BookingCapacityExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingCapacityExceededError';
  }
}

export type CheckInSealPayload = {
  sealAssignments: SealAssignmentInput[];
  faultySealNumbers: number[];
};

export interface IBookingService {
  checkIn(
    bookingId: string,
    seals?: CheckInSealPayload,
    actor?: PaymentActor,
  ): Promise<PartnerCheckInResult>;
  checkOut(bookingId: string): Promise<PartnerCheckOutResult>;
  getBookingByToken(token: string): Promise<BookingWithGuestShop | null>;
  createInitialBooking(data: CreateInitialBookingInput): Promise<Booking>;
  getUserBookings(userId: string, opts?: { page?: number; limit?: number }): Promise<{ items: GuestBookingListItem[]; total: number }>;
  getPartnerBookings(shopId: string, opts?: { page?: number; limit?: number }): Promise<{ items: PartnerBookingListItem[]; total: number }>;
  getBookingDetails(id: string): Promise<BookingWithShopGuestDetails | null>;
  cancelBooking(bookingId: string): Promise<CancelBookingResult>;
  markAsPaid(bookingId: string): Promise<void>;
  modifyBooking(
    bookingId: string,
    guestId: string,
    input: ModifyBookingInput
  ): Promise<ModifyBookingResult>;
}

/**
 * BookingService - BagajPark Operasyonel ve Finansal Yönetim Servisi
 */
export class BookingService implements IBookingService {
  /**
   * Misafir için ilk rezervasyonu oluşturur.
   */
  async createInitialBooking(data: CreateInitialBookingInput): Promise<Booking> {
    const rules = await getPricingRules();

    if (!validateBookingStayWindow(data.checkInTime, data.checkOutTime, rules)) {
      throw new Error('Geçersiz rezervasyon tarihleri.');
    }

    const newBags = totalBagCount(data.bagCountS, data.bagCountM, data.bagCountXl);
    
    // Slot-based booking path
    if (data.slotIds && data.slotIds.length > 0) {
      return this.createSlotBooking(data, newBags, rules);
    }

    // Legacy datetime-pair path (backward compat)
    const booking = await prisma.$transaction(
      async (tx) => {
        const shop = await tx.shop.findUnique({ where: { id: data.shopId } });
        if (!shop) {
          throw new Error('Dükkan bulunamadı.');
        }
        await tx.$executeRaw`SELECT 1 FROM "Shop" WHERE id = ${data.shopId} FOR UPDATE`;

        const unitPrice =
          typeof data.unitPrice === 'number' && Number.isFinite(data.unitPrice)
            ? data.unitPrice
            : moneyToNumber(shop.pricePerDay) || rules.defaultPricePerDay;
        const insuranceFee =
          typeof data.insuranceFee === 'number' && Number.isFinite(data.insuranceFee)
            ? Math.max(0, data.insuranceFee)
            : 0;

        await this.assertCapacityTx(
          tx,
          shop,
          data.shopId,
          data.checkInTime,
          data.checkOutTime,
          newBags,
          undefined
        );

        const referralDiscountAmount =
          typeof data.referralDiscountAmount === 'number' && Number.isFinite(data.referralDiscountAmount)
            ? Math.max(0, data.referralDiscountAmount)
            : 0;

        const booking = await tx.booking.create({
          data: {
            guestId: data.guestId ?? null,
            guestEmail: data.guestEmail ?? null,
            guestPhone: data.guestPhone ?? null,
            shopId: data.shopId,
            totalPrice: data.totalPrice,
            insuranceFee,
            referralDiscountAmount,
            referredByCode: data.referredByCode ?? null,
            bagCountS: data.bagCountS,
            bagCountM: data.bagCountM,
            bagCountXl: data.bagCountXl,
            checkInTime: data.checkInTime,
            checkOutTime: data.checkOutTime,
            unitPrice,
            pricingSnapshot: toPricingSnapshot(rules),
            qrCodeToken: `temp_${crypto.randomUUID()}`,
            status: 'PENDING',
          },
        });

        const qrCodeToken = await createQrToken({
          bookingId: booking.id,
          guestId: data.guestId ?? booking.id,
          shopId: data.shopId,
        });

        return tx.booking.update({
          where: { id: booking.id },
          data: { qrCodeToken },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    bookingEventService.record({
      bookingId: booking.id,
      event: "CREATED",
      actorId: data.guestId ?? "guest",
      actorRole: "GUEST",
      metadata: {
        shopId: data.shopId,
        totalPrice: data.totalPrice,
        bagCountS: data.bagCountS,
        bagCountM: data.bagCountM,
        bagCountXl: data.bagCountXl,
      },
    }).catch((err) => logger.error({ err, bookingId: booking.id }, "booking_event_created_failed"));

    return booking;
  }

  /**
   * Slot-based booking: reserves specific time slots with per-slot capacity.
   */
  private async createSlotBooking(
    data: CreateInitialBookingInput,
    newBags: number,
    rules: Awaited<ReturnType<typeof getPricingRules>>,
  ): Promise<Booking> {
    const booking = await prisma.$transaction(
      async (tx) => {
        const shop = await tx.shop.findUnique({ where: { id: data.shopId } });
        if (!shop) throw new Error('Dükkan bulunamadı.');

        const unitPrice =
          typeof data.unitPrice === 'number' && Number.isFinite(data.unitPrice)
            ? data.unitPrice
            : moneyToNumber(shop.pricePerHour ?? shop.pricePerDay) || rules.defaultPricePerDay;
        const insuranceFee =
          typeof data.insuranceFee === 'number' && Number.isFinite(data.insuranceFee)
            ? Math.max(0, data.insuranceFee)
            : 0;

        // Reserve slots via SlotService
        const { checkInTime, checkOutTime } = await reserveSlots(
          tx as Prisma.TransactionClient,
          data.shopId,
          data.checkInTime,
          data.checkOutTime,
          newBags,
        );

        /**
         * DÜKKAN KAPASİTESİ EMNİYET KONTROLÜ — slot kontrolüne EK olarak.
         *
         * NEDEN GEREKLİ (P1-2): iki rezervasyon yolu iki AYRI kapasite doğruluğu
         * kullanıyordu ve birbirlerini görmüyorlardı.
         *   - Legacy yol örtüşen `Booking` satırlarını sayar; `ReservationSlot`
         *     YAZMAZ.
         *   - Slot yolu yalnızca `ReservationSlot` satırlarını sayar.
         * Sonuç: legacy yolla yapılmış bir rezervasyon slot yolu için GÖRÜNMEZDİ,
         * yani slot yolu fiziksel dükkan kapasitesini AŞAN rezervasyon alabiliyordu.
         * Prod'da `ReservationSlot` tamamen boş (19 rezervasyona karşı 0 satır),
         * yani şu an her rezervasyon slot yolu için görünmez durumda.
         *
         * `Shop.capacity` FİZİKSEL gerçektir: dükkana kaç valiz sığdığı. Slot
         * kapasitesi onun içindeki daha ince bir dağıtımdır. İkisi birbirinin
         * yerine geçmez — fiziksel sınır her iki yolda da tutmak zorunda.
         *
         * Rezerve edilmiş pencere kullanılıyor (`checkInTime`/`checkOutTime`),
         * istenen değil: slot sınırlarına yuvarlanmış olabilir ve kaydedilen budur.
         */
        await this.assertCapacityTx(
          tx,
          shop,
          data.shopId,
          checkInTime,
          checkOutTime,
          newBags,
          undefined,
        );

        // Create ReservationSlot entries
        const slots = await tx.shopTimeSlot.findMany({
          where: {
            shopId: data.shopId,
            startTime: { gte: data.checkInTime },
            endTime: { lte: data.checkOutTime },
            isActive: true,
          },
        });

        const referralDiscountAmount =
          typeof data.referralDiscountAmount === 'number' && Number.isFinite(data.referralDiscountAmount)
            ? Math.max(0, data.referralDiscountAmount)
            : 0;

        const booking = await tx.booking.create({
          data: {
            guestId: data.guestId ?? null,
            guestEmail: data.guestEmail ?? null,
            guestPhone: data.guestPhone ?? null,
            shopId: data.shopId,
            totalPrice: data.totalPrice,
            insuranceFee,
            referralDiscountAmount,
            referredByCode: data.referredByCode ?? null,
            bagCountS: data.bagCountS,
            bagCountM: data.bagCountM,
            bagCountXl: data.bagCountXl,
            checkInTime,
            checkOutTime,
            unitPrice,
            pricingSnapshot: toPricingSnapshot(rules),
            qrCodeToken: `temp_${crypto.randomUUID()}`,
            status: 'PENDING',
            reservationSlots: {
              create: slots.map((s) => ({
                slotId: s.id,
                bagCount: newBags,
              })),
            },
          },
        });

        const qrCodeToken = await createQrToken({
          bookingId: booking.id,
          guestId: data.guestId ?? booking.id,
          shopId: data.shopId,
        });

        return tx.booking.update({
          where: { id: booking.id },
          data: { qrCodeToken },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    bookingEventService.record({
      bookingId: booking.id,
      event: "CREATED",
      actorId: data.guestId ?? "guest",
      actorRole: "GUEST",
      metadata: {
        shopId: data.shopId,
        totalPrice: data.totalPrice,
        slotBooking: true,
      },
    }).catch((err) => logger.error({ err, bookingId: booking.id }, "booking_event_created_failed"));

    return booking;
  }

  private async assertCapacityTx(
    tx: TxClient,
    shop: { capacity: number },
    shopId: string,
    checkInTime: Date,
    checkOutTime: Date,
    newBags: number,
    excludeBookingId?: string
  ): Promise<void> {
    const overlapping = await tx.booking.findMany({
      where: {
        shopId,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        status: {
          in: [
            'WAITING_APPROVAL',
            'APPROVED',
            'PENDING',
            'PAID',
            'CHECKED_IN',
          ],
        },
        OR: [
          // PAID ve CHECKED_IN her zaman sayılır
          { status: { in: ['PAID', 'CHECKED_IN'] } },
          // WAITING, APPROVED, PENDING ise sadece "taze" ise (check-in saati geçmemiş veya son 24 saat içinde)
          {
            AND: [
              { status: { in: ['WAITING_APPROVAL', 'APPROVED', 'PENDING'] } },
              { checkInTime: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
            ]
          }
        ],
        AND: [
          { checkInTime: { lt: checkOutTime } },
          { checkOutTime: { gt: checkInTime } },
        ],
      },
      select: { bagCountS: true, bagCountM: true, bagCountXl: true },
    });

    const used = overlapping.reduce(
      (sum, b) => sum + totalBagCount(b.bagCountS, b.bagCountM, b.bagCountXl),
      0
    );

    if (used + newBags > shop.capacity) {
      const remaining = Math.max(0, shop.capacity - used);
      throw new BookingCapacityExceededError(
        `Bu tarih aralığında dükkan kapasitesi yetersiz (kalan: ${remaining} valiz, talep: ${newBags}).`
      );
    }
  }

  /**
   * Valizin mühürle teslim alınması (Check-in).
   * En az bir valiz varsa mühür atamaları zorunludur (platform stokundan ASSIGNED mühürler).
   */
  async checkIn(
    bookingId: string,
    seals?: CheckInSealPayload,
    actor?: PaymentActor,
  ): Promise<PartnerCheckInResult> {
    try {
      const existing = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { shop: true, seals: true },
      });
      if (!existing) {
        return {
          ok: false,
          code: 'NOT_FOUND',
          message: 'Rezervasyon bulunamadı.',
        };
      }
      if (existing.status !== 'PAID' && (existing.status as string) !== 'APPROVED') {
        return {
          ok: false,
          code: 'INVALID_STATUS',
          message: `Check-in için onaylanmış veya ödenmiş olmalı (durum: ${existing.status}).`,
        };
      }
      if (
        !isShopOpenAt(
          existing.shop.openingTime,
          existing.shop.closingTime,
          new Date()
        )
      ) {
        logger.warn('BookingService::checkIn: dükkan kapalı saat aralığında');
        return {
          ok: false,
          code: 'SHOP_CLOSED',
          message:
            'Şu an dükkan kapalı görünüyor. Çalışma saatleri içinde tekrar deneyin.',
        };
      }

      /**
       * MÜHÜR KAYDI OLMADAN BAVUL KABUL EDİLMEZ — ayar açıksa (P1-23).
       *
       * 2026-08-22'de `BookingSeal` tablosu TAMAMEN BOŞTU, buna karşılık 3
       * `CHECKED_IN` rezervasyon vardı: üç bavul dükkanda ama hangi mühürle
       * mühürlendikleri hiçbir yerde kayıtlı değil. Mühür, anlaşmazlıkta
       * zilyetliğin kanıtıdır — "bu bavul mühürlü teslim alındı, numarası şu,
       * çıkışta aynı mühür sağlamdı". Kaydı yoksa platform hiçbir şey ispat edemez.
       *
       * `SEAL_REQUIRED` hata kodu tipte ZATEN VARDI ama hiç kullanılmıyordu —
       * zorlama planlanmış, hiç uygulanmamıştı.
       *
       * Ayar VARSAYILAN OLARAK KAPALI: lansmanda esnafın elinde mühür olmayabilir
       * ve açık olması check-in'i tamamen bloke eder.
       */
      const rules = await getPricingRules();
      if (rules.requireSealsOnCheckIn) {
        const bagCount = totalBagCount(
          existing.bagCountS,
          existing.bagCountM,
          existing.bagCountXl,
        );
        const providedSeals = seals?.sealAssignments?.length ?? 0;
        if (bagCount > 0 && providedSeals === 0) {
          return {
            ok: false,
            code: 'SEAL_REQUIRED',
            message: `Bu rezervasyonda ${bagCount} valiz var; her biri için mühür numarası girilmeli.`,
          };
        }
        if (providedSeals > 0 && providedSeals !== bagCount) {
          return {
            ok: false,
            code: 'SEAL_COUNT_MISMATCH',
            message: `${bagCount} valiz için ${providedSeals} mühür girildi; sayılar eşit olmalı.`,
          };
        }
      }

      /**
       * ÖDEME KANITI OLMADAN BAVUL KABUL EDİLMEZ (P1-9).
       *
       * 2026-08-22'de prod'da 7 rezervasyon ödeme kaydı olmadan ilerlemişti;
       * ikisinde bavul zaten dükkana teslim edilmişti. Kural yoktu.
       *
       * Doğru kural sağlayıcıya bağlıdır, sabit değil:
       *   - Sağlayıcı ONLINE tahsil ediyorsa (`capturesOnline`), para check-in'den
       *     ÖNCE alınmış olmalı. Alınmamışsa check-in reddedilir — misafir
       *     ödemeden bavul bırakamaz.
       *   - Sağlayıcı online tahsil ETMİYORSA (lansmandaki `manual`, yani dükkanda
       *     tahsilat), check-in **tam olarak paranın el değiştirdiği andır**.
       *     O yüzden burada tahsil ediliyor: niyet yoksa açılıyor, sonra
       *     yakalanıyor. Esnafın "aldım" beyanı deftere ve denetim izine yazılıyor.
       *
       * SIRA ÖNEMLİ — önce tahsilat, sonra check-in. Aradaki bir çökme `PAID` +
       * defter satırı bırakır ki bu GEÇERLİ bir durumdur (ödendi, henüz teslim
       * alınmadı). Ters sıra ise `CHECKED_IN` ama ödemesiz bırakırdı — düzeltmeye
       * çalıştığımız hatanın ta kendisi.
       */
      const alreadyCaptured = await paymentService.hasCapturedPayment(bookingId);
      if (!alreadyCaptured) {
        if (paymentService.capabilities.capturesOnline) {
          return {
            ok: false,
            code: 'PAYMENT_REQUIRED',
            message:
              'Bu rezervasyonun ödemesi alınmamış. Ödeme tamamlanmadan bavul teslim alınamaz.',
          };
        }

        const totalPrice = moneyToNumber(existing.totalPrice);
        const intent = await paymentService.openIntent({
          bookingId,
          amount: totalPrice,
          actor,
        });
        if (!intent.ok) {
          logger.error(
            { bookingId, code: intent.code, message: intent.message },
            'checkin_payment_intent_failed',
          );
          return {
            ok: false,
            code: 'PAYMENT_REQUIRED',
            message: 'Ödeme kaydı açılamadı; check-in tamamlanamıyor.',
          };
        }

        const captured = await paymentService.markCaptured({ bookingId, actor });
        if (!captured.ok) {
          logger.error(
            { bookingId, code: captured.code, message: captured.message },
            'checkin_payment_capture_failed',
          );
          return {
            ok: false,
            code: 'PAYMENT_REQUIRED',
            message: 'Tahsilat kaydedilemedi; check-in tamamlanamıyor.',
          };
        }
      }

      await prisma.$transaction(async (tx) => {
        const updateResult = await tx.booking.updateMany({
          where: { 
            id: bookingId,
            bookingRowVersion: existing.bookingRowVersion,
          },
          data: {
            status: 'CHECKED_IN',
            // GERÇEKLEŞEN teslim alma anı. Rezerve pencere (`checkInTime`)
            // değişmez — planlanan ile gerçekleşenin karışması P1-10'du.
            checkedInAt: new Date(),
            bookingRowVersion: { increment: 1 },
            updatedAt: new Date(),
          },
        });

        if (updateResult.count === 0) {
          throw new Error("Concurrency conflict: Rezervasyon başka bir işlem tarafından güncellendi.");
        }

        /**
         * Mühür yazımı `SealService`'e devredilir — burada satır içi YAZILMAZ.
         *
         * Buradaki eski satır içi döngü doğrulamanın TAMAMINI atlıyordu:
         * mührün bu dükkana ait olup olmadığına, `ASSIGNED` durumunda olup
         * olmadığına ve payload içinde tekrar edip etmediğine bakmıyordu. Yani
         * BAŞKA BİR DÜKKANIN mührü ya da HÂLİHAZIRDA `IN_USE` bir mühür ikinci
         * bir valize takılabiliyordu — mührün kanıt değerini bitiren şey tam da
         * budur. `faultySealNumbers` alanı ise hiç okunmuyordu; esnafın
         * "bu mühür bozuk çıktı" beyanı sessizce düşüyordu.
         *
         * `applyCheckInWithinTx` bu doğrulamaların hepsini yapar ve aşağıdaki
         * catch bloğunun ZATEN beklediği hata dizgelerini (`SEAL_INVALID:*`,
         * `SEAL_NOT_ASSIGNED:*`, `duplicate_seal_in_assignments`, ...) fırlatır.
         */
        if (seals?.sealAssignments?.length || seals?.faultySealNumbers?.length) {
          await sealService.applyCheckInWithinTx(tx, {
            shopId: existing.shopId,
            bookingId,
            assignments: seals.sealAssignments ?? [],
            faultySealNumbers: seals.faultySealNumbers ?? [],
            sealPhotoUrl: null,
          });
        }
      });

      bookingEventService.record({
        bookingId,
        event: "CHECKED_IN",
        metadata: { previousStatus: existing.status },
      }).catch((err) => logger.error({ err, bookingId }, "booking_event_checked_in_failed"));

      return { ok: true };
    } catch (error) {
      logger.error({ error }, 'BookingService::checkIn Error');
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === 'duplicate_seal_in_assignments') {
        return {
          ok: false,
          code: 'SEAL_INVALID',
          message: 'Aynı mühür numarası iki kez kullanılamaz.',
        };
      }
      if (msg === 'faulty_overlaps_assignment') {
        return {
          ok: false,
          code: 'FAULTY_OVERLAPS_ASSIGNMENT',
          message: 'Hatalı mühür ile atanan mühür aynı olamaz.',
        };
      }
      if (msg.startsWith('SEAL_FAULTY_INVALID')) {
        return {
          ok: false,
          code: 'SEAL_FAULTY_INVALID',
          message:
            'Hatalı işaretlenen mühür bulunamadı veya bu dükkana atanmamış.',
        };
      }
      if (msg.startsWith('SEAL_NOT_ASSIGNED')) {
        return {
          ok: false,
          code: 'SEAL_NOT_ASSIGNED',
          message: 'Mühür kullanılamıyor (atanmamış veya kullanımda).',
        };
      }
      if (msg.startsWith('SEAL_INVALID')) {
        return {
          ok: false,
          code: 'SEAL_INVALID',
          message: 'Mühür numarası geçersiz veya bu dükkana ait değil.',
        };
      }
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'Check-in sırasında beklenmeyen bir hata oluştu.',
      };
    }
  }

  /**
   * Valizin teslim edilmesi (Check-out) + Erken Teslimat İadesi.
   */
  async checkOut(bookingId: string): Promise<PartnerCheckOutResult> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Rezervasyon bulunamadı.',
      };
    }
    if (booking.status !== 'CHECKED_IN') {
      return {
        ok: false,
        code: 'INVALID_STATUS',
        message: `Teslim için valiz önce dükkana alınmış olmalı (durum: ${booking.status}).`,
      };
    }

    try {
      const now = new Date();

      const pricingRules = await getPricingRules();

      /**
       * Geç teslim alma ücreti — ARTIK KENDİ AYARINDAN.
       *
       * Eskiden `pricingRules.cancelFixedFeeTry` kullanılıyordu: iptal ücretini
       * değiştiren admin, gecikme ücretini de farkında olmadan değiştiriyordu.
       * Canlı `cancelFixedFeeTry = 0` olduğu için gecikme pratikte ÜCRETSİZDİ,
       * yani süreyi aşan müşterinin maliyetini partner üstleniyordu (P0-5).
       *
       * Tolerans da sabit 15 dakika değil, ayardan geliyor.
       */
      const scheduledEnd = new Date(booking.checkOutTime);
      const graceMs = pricingRules.latePickupGraceMin * 60 * 1000;
      const lateMs = now.getTime() - scheduledEnd.getTime();
      const lateFeeTry =
        lateMs > graceMs ? pricingRules.latePickupFeeTry : 0;
      if (lateFeeTry > 0) {
        logger.info(
          {
            bookingId,
            lateFeeTry,
            scheduledEnd: scheduledEnd.toISOString(),
            checkoutAt: now.toISOString(),
          },
          "booking_checkout_late_pickup_fee",
        );
      }

      // 1. Erken Teslimat İadesi Hesabı (UC_E_06_EXTRA)
      const { pricingService } = await import('./PricingService');
      const refundAmount = pricingService.calculateEarlyRefund(
        booking,
        now,
        pricingRules
      );

      // Harici ödeme sağlayıcısı yok; hesaplanan erken teslim tutarı manuel takip edilir.
      const failedRefundAmount = refundAmount;
      if (refundAmount > 0) {
        logger.info(
          { bookingId, refundAmount },
          'booking_early_checkout_refund_requires_manual_handling'
        );
      }

      // 2. Mühürleri iade + statüyü CHECKED_OUT yap (her durumda tamamlanır)
      await prisma.$transaction(async (tx) => {
        await sealService.applyCheckOutReturnSealsWithinTx(tx, bookingId);
        const updateResult = await tx.booking.updateMany({
          where: { id: bookingId, bookingRowVersion: booking.bookingRowVersion },
          data: {
            status: 'CHECKED_OUT',
            /**
             * `checkOutTime: now` KALDIRILDI (2026-08-22, P1-10).
             *
             * Rezerve bitiş zamanının üzerine yazmak, gecikme ücretinin ve erken
             * iadenin girdisini yok ediyordu: ikisi de `checkOutTime`'dan
             * hesaplanıyor, dolayısıyla çıkıştan sonra fatura yeniden kurulamıyordu.
             * Gerçekleşen an artık `checkedOutAt`.
             */
            checkedOutAt: now,
            lateFeeApplied: new Prisma.Decimal(lateFeeTry),
            pendingBagRevision: Prisma.JsonNull,
            bookingRowVersion: { increment: 1 },
            updatedAt: now,
            // İade başarısız olduysa reconcile için kayıt
            ...(failedRefundAmount > 0
              ? { failedRefundAmount: new Prisma.Decimal(failedRefundAmount) }
              : {}),
          },
        });
        if (updateResult.count === 0) {
          throw new Error("Concurrency conflict: Rezervasyon başka bir işlem tarafından güncellendi.");
        }
      });

      bookingEventService.record({
        bookingId,
        event: "CHECKED_OUT",
        metadata: {
          lateFeeApplied: lateFeeTry,
          refundAmount: refundAmount > 0 ? refundAmount : undefined,
          failedRefundAmount: failedRefundAmount > 0 ? failedRefundAmount : undefined,
        },
      }).catch((err) => logger.error({ err, bookingId }, "booking_event_checked_out_failed"));

      return {
        ok: true,
        ...(failedRefundAmount > 0
          ? { refundPending: true, refundAmount: failedRefundAmount }
          : {}),
      };
    } catch (error) {
      logger.error({ error }, 'BookingService::checkOut Error');
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'Teslim sırasında beklenmeyen bir hata oluştu.',
      };
    }
  }

  async getBookingByToken(token: string): Promise<BookingWithGuestShop | null> {
    const { verifyQrToken } = await import('@/lib/qr-token');
    const payload = await verifyQrToken(token);
    if (payload) {
      const booking = await prisma.booking.findUnique({
        where: { id: payload.bookingId },
        include: { guest: true, shop: true },
      });
      if (booking && booking.qrCodeToken === token) return booking;
    }
    return prisma.booking.findUnique({
      where: { qrCodeToken: token },
      include: { guest: true, shop: true },
    });
  }

  /**
   * Rezervasyonu ödenmiş yapar — ARTIK DEFTER ÜZERİNDEN.
   *
   * Eski hâli rezervasyonu doğrudan `PAID` yazıyordu ve hiçbir `PaymentLog`
   * satırı üretmiyordu; prod'da bu yüzden 7 tane "ödenmiş ama ödeme kaydı olmayan"
   * rezervasyon oluştu (P1-9). Artık niyet yoksa açılıyor, sonra tahsilat
   * işaretleniyor; ikisi de deftere ve denetim izine yazılıyor.
   */
  async markAsPaid(bookingId: string, actor?: PaymentActor): Promise<void> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { totalPrice: true },
    });
    if (!booking) {
      throw new Error(`markAsPaid: booking ${bookingId} not found`);
    }

    const intent = await paymentService.openIntent({
      bookingId,
      amount: moneyToNumber(booking.totalPrice),
      actor,
    });
    if (!intent.ok) {
      throw new Error(`markAsPaid: ${intent.code} — ${intent.message}`);
    }

    const captured = await paymentService.markCaptured({ bookingId, actor });
    if (!captured.ok) {
      throw new Error(`markAsPaid: ${captured.code} — ${captured.message}`);
    }
  }

  async getBookingDetails(id: string): Promise<BookingWithShopGuestDetails | null> {
    return await prisma.booking.findUnique({
      where: { id },
      include: {
        shop: { include: { owner: true } },
        guest: true,
        seals: { orderBy: { bagIndex: "asc" } },
      },
    });
  }

  async getUserBookings(userId: string, opts?: { page?: number; limit?: number }): Promise<{ items: GuestBookingListItem[]; total: number }> {
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 50;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where: { guestId: userId },
        select: {
          id: true, guestId: true, shopId: true, checkInTime: true, checkOutTime: true,
          totalPrice: true, bagCountS: true, bagCountM: true, bagCountXl: true,
          status: true, qrCodeToken: true, createdAt: true,
          shop: { select: { name: true, address: true, pricePerDay: true } },
          dispute: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where: { guestId: userId } }),
    ]);
    return { items, total };
  }

  async getPartnerBookings(shopId: string, opts?: { page?: number; limit?: number }): Promise<{ items: PartnerBookingListItem[]; total: number }> {
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 100;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where: { shopId },
        select: {
          id: true, checkInTime: true, checkOutTime: true,
          totalPrice: true, bagCountS: true, bagCountM: true, bagCountXl: true,
          status: true, createdAt: true,
          guest: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where: { shopId } }),
    ]);
    return { items, total };
  }

  /**
   * Tek kullanımlı indirim kuponu = “platform kredisi” (check-in’e &lt;1 saat kala nakit iade yok).
   */
  private async issueCancellationCreditCoupon(amountTry: number): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `EM${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
      try {
        await prisma.coupon.create({
          data: {
            code,
            discount: Math.round(amountTry * 100) / 100,
            isPercent: false,
            maxUses: 1,
            usedCount: 0,
            isActive: true,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        });
        return code;
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new Error('credit_coupon_generation_failed');
  }

  /**
   * Rezervasyon İptali ve İade Süreci
   * Kademe: ≥24s check-in → tam kart iadesi; ≥1s → %50 kart iadesi; &lt;1s veya geçmiş check-in → kartsız, tek kullanımlı kupon (tutar kadar).
   * Ödeme alınmışsa iade başarısızsa rezervasyon CANCELLED yapılmaz.
   */
  async cancelBooking(bookingId: string): Promise<CancelBookingResult> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { reservationSlots: true },
    });

    if (!booking) {
      return { ok: false, code: 'NOT_FOUND', message: 'Rezervasyon bulunamadı.' };
    }
    if (
      booking.status === 'CANCELLED' ||
      booking.status === 'CHECKED_IN' ||
      booking.status === 'CHECKED_OUT'
    ) {
      return {
        ok: false,
        code: 'INVALID_STATUS',
        message: 'Bu rezervasyon iptal edilemez.',
      };
    }

    const hasCapturedPayment = await prisma.paymentLog.findFirst({
      where: { bookingId, status: 'SUCCESS' },
    });
    const hadPayment =
      booking.status === 'PAID' || !!hasCapturedPayment;

    try {
      // İade defter üzerinden. Ham `updateMany` kaldırıldı: kısmi iadeyi
      // modelleyemiyordu, `refundedAmount` yazmıyordu ve denetim izi bırakmıyordu.
      if (hadPayment) {
        const refunded = await paymentService.refund({
          bookingId,
          reason: 'booking_cancelled',
        });
        if (!refunded.ok && refunded.code !== 'NOTHING_TO_REFUND') {
          logger.error(
            { bookingId, code: refunded.code, message: refunded.message },
            "payment_refund_mark_failed",
          );
        }
      } else {
        // Tahsilat olmadan iptal: açık kalmış niyeti kapat, defterde PENDING
        // satır sürünmesin.
        await paymentService
          .cancelIntent({ bookingId })
          .catch((err) => logger.error({ err, bookingId }, "payment_intent_cancel_failed"));
      }

      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'CANCELLED' },
        });

        if (booking.reservationSlots.length > 0) {
          await tx.reservationSlot.deleteMany({ where: { bookingId } });
        }
      });

      // Sadakat puanlarını geri al
      if (booking.guestId) {
        const earnedPoints = Math.floor(moneyToNumber(booking.totalPrice));
        if (earnedPoints > 0) {
          prisma.$executeRaw`UPDATE "User" SET "loyaltyPoints" = GREATEST(0, "loyaltyPoints" - ${earnedPoints}) WHERE id = ${booking.guestId}`.catch((err) =>
            logger.error({ err, bookingId, guestId: booking.guestId, earnedPoints }, "loyalty_points_decrement_failed")
          );
        }
      }

      bookingEventService.record({
        bookingId,
        event: "CANCELLED",
        metadata: { previousStatus: booking.status, hadPayment, fullRefund: true },
      }).catch((err) => logger.error({ err, bookingId }, "booking_event_cancelled_failed"));

      return { ok: true, fullRefund: hadPayment };
    } catch (error) {
      logger.error({ err: error, bookingId }, 'BookingService::cancelBooking');
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'İptal sırasında beklenmeyen bir hata oluştu.',
      };
    }
  }

  /**
   * Misafir rezervasyonunu günceller (tarih / valiz sayıları).
   * Ödeme alınmışsa tutar düşüşünde kısmi iade; tutar artışı desteklenmez (iptal + yeniden rezervasyon).
   */
  async modifyBooking(
    bookingId: string,
    guestId: string,
    input: ModifyBookingInput
  ): Promise<ModifyBookingResult> {
    const rules = await getPricingRules();

    if (
      !validateBookingStayWindow(
        input.checkInTime,
        input.checkOutTime,
        rules
      )
    ) {
      return {
        ok: false,
        code: 'INVALID_DATES',
        message: 'Geçersiz tarih aralığı.',
      };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { shop: true },
    });

    if (!booking) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'Rezervasyon bulunamadı.',
      };
    }
    if (booking.guestId !== guestId) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Bu rezervasyonu düzenleyemezsiniz.',
      };
    }

    if (
      booking.status === 'CHECKED_IN' ||
      booking.status === 'CHECKED_OUT' ||
      booking.status === 'CANCELLED'
    ) {
      return {
        ok: false,
        code: 'INVALID_STATUS',
        message: 'Bu rezervasyon düzenlenemez.',
      };
    }

    const hasCapturedPayment = await prisma.paymentLog.findFirst({
      where: { bookingId, status: 'SUCCESS' },
    });
    const isPaidLike =
      booking.status === 'PAID' || !!hasCapturedPayment;

    const unitPrice = moneyToNumber(booking.shop.pricePerDay);
    const authTotals = computeAuthoritativeCheckoutTotals(
      unitPrice,
      input.bagCountS,
      input.bagCountM,
      input.bagCountXl,
      input.checkInTime,
      input.checkOutTime,
      rules
    );
    const bagTotal =
      authTotals.bagCountS +
      authTotals.bagCountM +
      authTotals.bagCountXl;
    if (bagTotal < 1) {
      return {
        ok: false,
        code: 'INVALID_STATUS',
        message: 'En az bir valiz seçilmelidir.',
      };
    }
    const newTotal = authTotals.subtotalBeforeCoupon;
    const oldTotal = moneyToNumber(booking.totalPrice);

    if (isPaidLike && Math.abs(newTotal - oldTotal) > 0.005) {
      return {
        ok: false,
        code: 'PRICE_INCREASE',
        message:
          'Geçmiş ödeme kaydı bulunan rezervasyonun tutarı değiştirilemez.',
      };
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT 1 FROM "Shop" WHERE id = ${booking.shopId} FOR UPDATE`;
          const shop = await tx.shop.findUnique({
            where: { id: booking.shopId },
          });
          if (!shop) {
            throw new Error('Shop missing');
          }

          const newBags = totalBagCount(
            input.bagCountS,
            input.bagCountM,
            input.bagCountXl
          );
          await this.assertCapacityTx(
            tx,
            shop,
            booking.shopId,
            input.checkInTime,
            input.checkOutTime,
            newBags,
            bookingId
          );

          await tx.booking.update({
            where: { id: bookingId },
            data: {
              checkInTime: input.checkInTime,
              checkOutTime: input.checkOutTime,
              bagCountS: authTotals.bagCountS,
              bagCountM: authTotals.bagCountM,
              bagCountXl: authTotals.bagCountXl,
              unitPrice: authTotals.unitPrice,
              insuranceFee: authTotals.insuranceFee,
              totalPrice: newTotal,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      bookingEventService.record({
        bookingId,
        event: "MODIFIED",
        actorId: guestId,
        actorRole: "GUEST",
        metadata: {
          previousTotal: moneyToNumber(booking.totalPrice),
          newTotal,
          checkInTime: input.checkInTime,
          checkOutTime: input.checkOutTime,
          bagCountS: input.bagCountS,
          bagCountM: input.bagCountM,
          bagCountXl: input.bagCountXl,
        },
      }).catch((err) => logger.error({ err, bookingId }, "booking_event_modified_failed"));

      return { ok: true };
    } catch (error) {
      if (error instanceof BookingCapacityExceededError) {
        return {
          ok: false,
          code: 'CAPACITY',
          message: error.message,
        };
      }
      logger.error({ err: error, bookingId }, 'BookingService::modifyBooking');
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'Düzenleme sırasında beklenmeyen bir hata oluştu.',
      };
    }
  }
}

export const bookingService = new BookingService();

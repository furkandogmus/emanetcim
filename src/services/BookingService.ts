import { Booking, BookingStatus, Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { type SealAssignmentInput } from '@/services/SealService';
import { moneyToNumber } from '@/lib/money';
import { PartnerCheckInResult, PartnerCheckOutResult, CancelBookingResult, ModifyBookingResult, BookingWithShopGuestDetails } from '@/types/partner-booking';
import { paymentService, type PaymentActor } from '@/services/PaymentService';
import { createInitialBooking as createInitialBookingImpl } from '@/services/booking/create';
import { checkIn as checkInImpl } from '@/services/booking/check-in';
import { checkOut as checkOutImpl } from '@/services/booking/check-out';
import { cancelBooking as cancelBookingImpl, modifyBooking as modifyBookingImpl } from '@/services/booking/lifecycle';
import {
  approveBooking as approveBookingImpl,
  rejectBooking as rejectBookingImpl,
  type PartnerReviewActor,
  type PartnerReviewResult,
  forceCancelOpenBookingsForUser as forceCancelOpenBookingsForUserImpl,
  type ForceCancelSummary,
} from '@/services/booking/partner-review';
import {
  proposeBagRevision as proposeBagRevisionImpl,
  applyBagRevision as applyBagRevisionImpl,
  clearBagRevision as clearBagRevisionImpl,
  type BagRevisionActor,
  type BagCounts,
  type BagRevisionResult,
  type ProposeRevisionResult,
} from '@/services/booking/bag-revision';

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
  /**
   * Kupon indirimi -- referans indirimiyle AYNI muamele.
   *
   * 2026-09-01'e kadar kupon yalnizca `totalPrice`i dusuruyordu ve kendisinden
   * hicbir iz kalmiyordu; referans indirimi ise ta bastan kaydediliyordu. Ayni
   * olay bir yolda denetlenebilir, digerinde gorunmezdi.
   */
  couponDiscountAmount?: number;
  couponCode?: string;
  /** Time-slot based: if provided, slot IDs to reserve instead of datetime pair */
  slotIds?: string[];
  /**
   * Rezervasyonun YARATILDIGI durum. Verilmezse `PENDING`.
   * Misafir akislari `APPROVED` gecer — gerekce `src/services/booking/create.ts`.
   */
  initialStatus?: BookingStatus;
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
    shop: { select: { name: true; address: true; pricePerDay: true; timezone: true } };
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
export type TxClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$use'
>;

export { BookingCapacityExceededError } from '@/services/booking/errors';
export type { PartnerReviewActor, PartnerReviewResult, PartnerReviewErrorCode, ForceCancelSummary } from '@/services/booking/partner-review';
export type { BagRevisionActor, BagCounts, BagRevisionResult, ProposeRevisionResult, BagRevisionErrorCode } from '@/services/booking/bag-revision';

export type CheckInSealPayload = {
  sealAssignments: SealAssignmentInput[];
  faultySealNumbers: number[];
  /**
   * Mühürlenmiş valizin kanıt fotoğrafının adresi.
   *
   * SUNUCUNUN ÜRETTİĞİ DEĞER — istemciden GELMEZ ve `checkInSealsSchema`da
   * yoktur. İstemci baytları gönderir, sunucu doğrular ve depolamaya yazar;
   * adres oradan döner. Aksi hâlde esnaf bu alana istediği adresi yazabilir ve
   * uyuşmazlıkta "kanıt" diye gösterilen şey onun seçtiği bir görsel olurdu.
   */
  sealPhotoUrl?: string | null;
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
  approveBooking(bookingId: string, actor: PartnerReviewActor, opts?: { locale?: string }): Promise<PartnerReviewResult>;
  rejectBooking(bookingId: string, actor: PartnerReviewActor, opts?: { locale?: string }): Promise<PartnerReviewResult>;
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

/**
 * Rezervasyon servisi — CEPHE.
 *
 * 2026-08-22'ye kadar 1186 satırlık tek sınıftı. Yaşam döngüsü adımları artık
 * `src/services/booking/` altında ayrı modüller (create, check-in, check-out,
 * lifecycle); burada yalnızca sorgular ve dışa açık imza kaldı. Çağıranlar ve
 * testler `bookingService.checkIn(...)` demeye devam eder.
 */
export class BookingService implements IBookingService {
  async createInitialBooking(data: CreateInitialBookingInput): Promise<Booking> {
    return createInitialBookingImpl(data);
  }

  async checkIn(bookingId: string,
    seals?: CheckInSealPayload,
    actor?: PaymentActor,): Promise<PartnerCheckInResult> {
    return checkInImpl(bookingId, seals, actor);
  }

  async checkOut(bookingId: string): Promise<PartnerCheckOutResult> {
    return checkOutImpl(bookingId);
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
          // `timezone`: rezervasyon değiştirme modalı saatleri dükkanın
          // diliminde yorumlamalı; checkout ile aynı sözleşme.
          shop: { select: { name: true, address: true, pricePerDay: true, timezone: true } },
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

  async cancelBooking(bookingId: string): Promise<CancelBookingResult> {
    return cancelBookingImpl(bookingId);
  }

  /**
   * Esnaf/admin talebi onaylar. Web action'i ve mobil uc AYNI govdeyi cagirir —
   * ayrintili gerekce `src/services/booking/partner-review.ts` basinda.
   */
  async approveBooking(
    bookingId: string,
    actor: PartnerReviewActor,
    opts?: { locale?: string },
  ): Promise<PartnerReviewResult> {
    return approveBookingImpl(bookingId, actor, opts);
  }

  /** Esnaf/admin talebi reddeder; iptalin tamami `cancelBooking`'e devredilir. */
  async rejectBooking(
    bookingId: string,
    actor: PartnerReviewActor,
    opts?: { locale?: string },
  ): Promise<PartnerReviewResult> {
    return rejectBookingImpl(bookingId, actor, opts);
  }

  /**
   * Valiz revizyonu — govde `src/services/booking/bag-revision.ts`'te.
   * Web iki adimli (oner -> uygula), mobil tek adimli; ikisi de AYNI govdeyi kullanir.
   */
  async proposeBagRevision(
    bookingId: string,
    counts: BagCounts,
    actor: BagRevisionActor,
  ): Promise<ProposeRevisionResult> {
    return proposeBagRevisionImpl(bookingId, counts, actor);
  }

  async applyBagRevision(
    bookingId: string,
    actor: BagRevisionActor,
    opts?: { counts?: BagCounts; source?: 'web' | 'mobile' },
  ): Promise<BagRevisionResult> {
    return applyBagRevisionImpl(bookingId, actor, opts);
  }

  async clearBagRevision(bookingId: string, actor: BagRevisionActor) {
    return clearBagRevisionImpl(bookingId, actor);
  }

  /**
   * Kullanici silinirken acik rezervasyonlarini iptal eder — iade ve kapasite
   * muhasebesiyle birlikte. Gerekce `src/services/booking/partner-review.ts`.
   */
  async forceCancelOpenBookingsForUser(
    userId: string,
    openStatuses: BookingStatus[],
  ): Promise<ForceCancelSummary> {
    return forceCancelOpenBookingsForUserImpl(userId, openStatuses);
  }

  async modifyBooking(bookingId: string,
    guestId: string,
    input: ModifyBookingInput): Promise<ModifyBookingResult> {
    return modifyBookingImpl(bookingId, guestId, input);
  }
}
export const bookingService = new BookingService();

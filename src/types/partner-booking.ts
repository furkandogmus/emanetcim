import { Prisma } from "@prisma/client";

export type PartnerCheckInErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "SHOP_CLOSED"
  /**
   * Ödeme kanıtı yok ve tahsilat da yapılamadı.
   *
   * Online tahsil eden bir sağlayıcıda: misafir ödemeden bavul bırakamaz.
   * Dükkanda tahsilat modunda: check-in paranın el değiştirdiği andır ve o kayıt
   * yazılamadıysa bavul kabul edilmemelidir (P1-9).
   */
  | "PAYMENT_REQUIRED"
  | "SEAL_REQUIRED"
  | "SEAL_COUNT_MISMATCH"
  | "SEAL_INVALID"
  | "SEAL_FAULTY_INVALID"
  | "SEAL_NOT_ASSIGNED"
  | "FAULTY_OVERLAPS_ASSIGNMENT"
  | "UNKNOWN";

export type PartnerCheckOutErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "REFUND_FAILED"
  | "UNKNOWN";

export type PartnerCheckInResult =
  | { ok: true }
  | { ok: false; code: PartnerCheckInErrorCode; message: string };

export type PartnerCheckOutResult =
  | { ok: true; refundPending?: boolean; refundAmount?: number }
  | { ok: false; code: PartnerCheckOutErrorCode; message: string };

export type CancelBookingErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "REFUND_FAILED"
  | "UNKNOWN";

export type BookingWithShopGuestDetails = Prisma.BookingGetPayload<{
  include: {
    shop: { include: { owner: true } };
    guest: true;
    seals: { orderBy: { bagIndex: "asc" } };
  };
}>;

export type CancelBookingResult =
  | { ok: true; fullRefund?: boolean }
  | { ok: false; code: CancelBookingErrorCode; message: string };

export type ModifyBookingErrorCode =
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "INVALID_STATUS"
  | "INVALID_DATES"
  | "CAPACITY"
  | "REFUND_FAILED"
  | "PRICE_INCREASE"
  | "UNKNOWN";

export type ModifyBookingResult =
  | { ok: true }
  | { ok: false; code: ModifyBookingErrorCode; message: string };

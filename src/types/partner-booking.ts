import { Prisma } from "@prisma/client";

export type PartnerCheckInErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "SHOP_CLOSED"
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
  | { ok: true; creditCode?: string }
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

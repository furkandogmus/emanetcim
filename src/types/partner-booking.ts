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
  | { ok: true }
  | { ok: false; code: PartnerCheckOutErrorCode; message: string };

export type CancelBookingErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "REFUND_FAILED"
  | "UNKNOWN";

export type CancelBookingResult =
  | { ok: true }
  | { ok: false; code: CancelBookingErrorCode; message: string };

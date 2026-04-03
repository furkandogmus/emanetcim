export type PartnerCheckInErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "SHOP_CLOSED"
  | "UNKNOWN";

export type PartnerCheckOutErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "UNKNOWN";

export type PartnerCheckInResult =
  | { ok: true }
  | { ok: false; code: PartnerCheckInErrorCode; message: string };

export type PartnerCheckOutResult =
  | { ok: true }
  | { ok: false; code: PartnerCheckOutErrorCode; message: string };

import type { PartnerReviewErrorCode } from "@/services/BookingService";

/**
 * Servis sonuc KODU -> mobil HTTP yaniti.
 *
 * Ayri bir dosya olmasinin sebebi: onay ve red uclari ayni esleme yaziyordu ve
 * biri digerinden sapabiliyordu (red ucu `403`'u hic uretmiyordu, cunku admin
 * ayrimini yapmiyordu). Mobil istemcinin gordugu kodlar DEGISMEDI.
 */
export const REVIEW_CODE_TO_HTTP: Record<
  PartnerReviewErrorCode,
  { status: number; error: string }
> = {
  NOT_FOUND: { status: 404, error: "not_found" },
  FORBIDDEN: { status: 403, error: "forbidden" },
  INVALID_STATUS: { status: 409, error: "state_conflict" },
  UNKNOWN: { status: 500, error: "server_error" },
};

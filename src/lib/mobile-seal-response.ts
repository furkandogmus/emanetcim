import type { SealRequestErrorCode } from "@/services/SealService";

/**
 * Servis sonuc KODU -> mobil HTTP yaniti.
 *
 * Mobil istemcinin gordugu hata kodlari 2026-08-25 oncesiyle ayni tutuldu
 * (`no_shop`, `not_found`, `invalid_data`, `server_error`); degisen tek sey,
 * yanitin artik servis sonucundan TURETILIYOR olmasi.
 */
export const SEAL_CODE_TO_HTTP: Record<
  SealRequestErrorCode,
  { status: number; error: string }
> = {
  FORBIDDEN: { status: 403, error: "forbidden" },
  INVALID_QUANTITY: { status: 400, error: "invalid_data" },
  SHOP_NOT_FOUND: { status: 404, error: "no_shop" },
  REQUEST_NOT_FOUND: { status: 404, error: "not_found" },
  REQUEST_NOT_SHIPPED: { status: 409, error: "not_found" },
  /* Asagidaki ucu yalnizca admin kargolama yolunda uretilir; mobil uc bunlari
     hic gormez ama `Record` tam kapsamli oldugu icin burada da tanimli olmali. */
  REQUEST_NOT_PENDING: { status: 409, error: "not_found" },
  TRACKING_REQUIRED: { status: 400, error: "invalid_data" },
  INVALID_SERIAL_RANGE: { status: 400, error: "invalid_data" },
  UNKNOWN: { status: 500, error: "server_error" },
};

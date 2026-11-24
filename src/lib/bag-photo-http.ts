import type { BagPhotoFailure } from "@/services/BagPhotoService";

/** Servis hata kodu -> HTTP durum (mobil uclar). */
export const BAG_PHOTO_ERROR_STATUS: Record<BagPhotoFailure, number> = {
  not_found: 404,
  forbidden: 403,
  read_only: 403,
  storage_unavailable: 503,
  rate_limited: 429,
  locked: 409,
  limit: 409,
  empty: 400,
  too_large: 413,
  unsupported_type: 415,
  dimensions_too_large: 413,
};

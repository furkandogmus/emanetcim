import type { BookingStatus } from "@prisma/client";

export type PartnerBookingsFilter = "all" | "action" | "payment" | "done";

/**
 * TEK doğruluk kaynağı: hem `bookingMatchesPartnerFilter` (istemci/liste
 * mantığı) hem `partnerBookingsFilterStatuses` (Prisma `where` sorgusu) aynı
 * kümeyi buradan okur. Ayrı ayrı tanımlanmış olsalardı ikisi zamanla
 * birbirinden sapabilirdi (bkz. `platform-split.ts`'teki
 * `EARNING_BOOKING_STATUSES` — tam bu sınıf hatanın daha önce yakalandığı yer).
 */
const FILTER_STATUSES: Record<Exclude<PartnerBookingsFilter, "all">, BookingStatus[]> = {
  action: ["WAITING_APPROVAL", "PAID", "CHECKED_IN"],
  payment: ["PENDING", "APPROVED"],
  done: ["CHECKED_OUT", "CANCELLED"],
};

export function parsePartnerBookingsFilter(raw: string | undefined): PartnerBookingsFilter {
  if (raw === "action" || raw === "payment" || raw === "done") return raw;
  return "all";
}

export function bookingMatchesPartnerFilter(
  status: BookingStatus,
  filter: PartnerBookingsFilter
): boolean {
  if (filter === "all") return true;
  return FILTER_STATUSES[filter].includes(status);
}

/**
 * Prisma `where` sorgusu için: filtreye karşılık gelen durum kümesi,
 * "all" için `undefined` (koşul eklenmesin diye).
 */
export function partnerBookingsFilterStatuses(
  filter: PartnerBookingsFilter,
): BookingStatus[] | undefined {
  if (filter === "all") return undefined;
  return FILTER_STATUSES[filter];
}

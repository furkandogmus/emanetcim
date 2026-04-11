import type { BookingStatus } from "@prisma/client";

export type PartnerBookingsFilter = "all" | "action" | "payment" | "done";

export function parsePartnerBookingsFilter(raw: string | undefined): PartnerBookingsFilter {
  if (raw === "action" || raw === "payment" || raw === "done") return raw;
  return "all";
}

export function bookingMatchesPartnerFilter(
  status: BookingStatus,
  filter: PartnerBookingsFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "action") {
    return (
      status === "WAITING_APPROVAL" || status === "PAID" || status === "CHECKED_IN"
    );
  }
  if (filter === "payment") {
    return status === "PENDING" || status === "APPROVED";
  }
  if (filter === "done") {
    return status === "CHECKED_OUT" || status === "CANCELLED";
  }
  return true;
}

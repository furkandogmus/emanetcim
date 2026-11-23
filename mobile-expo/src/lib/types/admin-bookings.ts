import type { BookingSummary } from "./booking";

export type AdminBookingFilter = "arrivals" | "pickups" | "inStorage" | "overdue" | "noShow" | "upcoming" | "all";

/** `admin/bookings` (`toMobileAdminBookingRow`). */
export type AdminBookingRow = BookingSummary & { guestName: string; createdAt: string };

export type AdminBookingsResponse = { bookings: AdminBookingRow[]; nextCursor?: string | null };

export type AdminBookingCounts = Record<AdminBookingFilter, number>;

/** `admin/bookings/[id]` (`toMobileAdminBookingDetail`). QR token'i yok. */
export type AdminBookingDetail = AdminBookingRow & {
  guest: { id?: string | null; name: string; email: string; phone: string; whatsapp?: string | null; canViewAs?: boolean };
  shop: {
    id?: string;
    ownerId?: string;
    name: string;
    address: string;
    phone: string;
    whatsapp?: string | null;
    ownerName: string;
    canViewAsOwner?: boolean;
    latitude: number | null;
    longitude: number | null;
  };
  seals: { sealNumber: number; bagIndex: number; bagSize: string }[];
  checkedInAt: string | null;
  checkedOutAt: string | null;
  couponCode: string | null;
  disputeStatus: string | null;
  paymentStatus: string | null;
  events: { event: string; actorRole: string | null; createdAt: string }[];
  /** Esnaf detayindaki alanla ayni anlam; eski sunucu gondermez. */
  noShowAvailableAt?: string | null;
};

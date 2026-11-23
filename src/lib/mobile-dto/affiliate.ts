import { moneyToNumber } from "@/lib/money";

type AffiliateStatsSource = {
  clicks: number;
  bookings: number;
  completedBookings: number;
  earned: number;
  unpaid: number;
  paid: number;
};

/** Yonetici araci satiri (web + mobil ayni alanlar). Notlar yalniz yoneticiye. */
export function toMobileAdminAffiliate(a: {
  id: string;
  code: string;
  displayName: string;
  type: string;
  status: string;
  contactEmail: string | null;
  contactPhone: string | null;
  commissionRate: unknown;
  guestDiscountRate: unknown;
  notes: string | null;
  applicationNote: string | null;
  createdAt: Date;
  user: { email: string | null } | null;
  stats: AffiliateStatsSource;
}) {
  return {
    id: a.id,
    code: a.code,
    displayName: a.displayName,
    type: a.type.toLowerCase(),
    status: a.status.toLowerCase(),
    contactEmail: a.contactEmail,
    contactPhone: a.contactPhone,
    commissionRate: moneyToNumber(a.commissionRate),
    guestDiscountRate: moneyToNumber(a.guestDiscountRate),
    notes: a.notes,
    applicationNote: a.applicationNote,
    linkedUserEmail: a.user?.email ?? null,
    createdAt: a.createdAt.toISOString(),
    stats: {
      clicks: a.stats.clicks,
      bookings: a.stats.bookings,
      completedBookings: a.stats.completedBookings,
      earned: a.stats.earned,
      unpaid: a.stats.unpaid,
      paid: a.stats.paid,
    },
  };
}

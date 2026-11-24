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

/**
 * Aracinin kendi paneli (`GET /affiliate/me`). Kaynak `AffiliateService.getPanelForUser`:
 * misafir adi/iletisimi zaten secilmiyor; rezervasyonlar yalniz gun, dukkan ve tutar.
 */
export function toMobileAffiliatePanel(
  p: {
    code: string;
    displayName: string;
    status: string;
    commissionRate: number;
    guestDiscountRate: number;
    stats: AffiliateStatsSource;
    bookings: {
      day: string;
      shopName: string;
      amount: number;
      completed: boolean;
      cancelled: boolean;
      commission: number | null;
      commissionPaid: boolean;
    }[];
  },
  link: string,
) {
  const active = p.status === "active";
  return {
    code: p.code,
    displayName: p.displayName,
    status: p.status,
    // Bekleyen basvurunun kodu rastgele ve gecici: paylasilacak link yalniz onaydan sonra.
    link: active ? link : null,
    commissionRate: p.commissionRate,
    guestDiscountRate: p.guestDiscountRate,
    stats: {
      clicks: p.stats.clicks,
      bookings: p.stats.bookings,
      completedBookings: p.stats.completedBookings,
      earned: p.stats.earned,
      unpaid: p.stats.unpaid,
      paid: p.stats.paid,
    },
    bookings: p.bookings.map((b) => ({
      day: b.day,
      shopName: b.shopName,
      amount: b.amount,
      completed: b.completed,
      cancelled: b.cancelled,
      commission: b.commission,
      commissionPaid: b.commissionPaid,
    })),
  };
}

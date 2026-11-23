/** `toMobileAdminAffiliate` (kaynak `../src/lib/mobile-dto/affiliate.ts`). */
export type AdminAffiliateType = "airbnb_host" | "hotel" | "guide" | "agency" | "other";

export type AdminAffiliateStatus = "pending" | "active" | "paused";

export type AdminAffiliate = {
  id: string;
  code: string;
  displayName: string;
  type: AdminAffiliateType;
  status: AdminAffiliateStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  commissionRate: number;
  guestDiscountRate: number;
  notes: string | null;
  applicationNote: string | null;
  linkedUserEmail: string | null;
  createdAt: string;
  stats: { clicks: number; bookings: number; completedBookings: number; earned: number; unpaid: number; paid: number };
};

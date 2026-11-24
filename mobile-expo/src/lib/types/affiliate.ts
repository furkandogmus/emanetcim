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

/** `toMobileAffiliatePanel`: `GET /affiliate/me`. `link` yalniz onayli aracida dolu. */
export type AffiliatePanel = {
  code: string;
  displayName: string;
  status: AdminAffiliateStatus;
  link: string | null;
  commissionRate: number;
  guestDiscountRate: number;
  stats: AdminAffiliate["stats"];
  bookings: {
    day: string;
    shopName: string;
    amount: number;
    completed: boolean;
    cancelled: boolean;
    commission: number | null;
    commissionPaid: boolean;
  }[];
};

export type AffiliateApplication = {
  displayName: string;
  type: AdminAffiliateType;
  contactEmail?: string;
  contactPhone?: string;
  applicationNote?: string;
};

/** `POST /account/data-export` (her rol, e-postayla). */
export type DataExportResult = { ok: true; email: string };

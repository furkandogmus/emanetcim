/* ===================== Kampanyalar ve esnaf olusturma (kaynak: ../src/lib/mobile-dto/admin-campaigns.ts) ===================== */

/** `toMobileAdminCampaign`. */
export type AdminCampaign = {
  id: string;
  name: string;
  message: string | null;
  discountPercent: number | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

/** `toMobileAdminPartnerCreated`: `resetUrl` sifresi olan misafir cevrildiginde null. */
export type AdminPartnerCreated = {
  userId: string;
  shopId: string;
  phone: string;
  resetUrl: string | null;
};

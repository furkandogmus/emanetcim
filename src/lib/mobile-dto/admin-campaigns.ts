import { moneyToNumber } from "@/lib/money";

type CampaignSource = {
  id: string;
  name: string;
  message: string | null;
  discountPercent: unknown | null;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
};

/** `admin/campaigns` satiri. */
export function toMobileAdminCampaign(c: CampaignSource) {
  return {
    id: c.id,
    name: c.name,
    message: c.message,
    discountPercent: c.discountPercent == null ? null : moneyToNumber(c.discountPercent),
    isActive: c.isActive,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

/** `admin/partners` POST yaniti: esnafa iletilecek sifre bagi (sifresi olan misafirde null). */
export function toMobileAdminPartnerCreated(r: {
  userId: string;
  shopId: string;
  phone: string;
  resetUrl: string | null;
}) {
  return { userId: r.userId, shopId: r.shopId, phone: r.phone, resetUrl: r.resetUrl };
}

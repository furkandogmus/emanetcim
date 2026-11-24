/** `toMobileShopTeam` (../src/lib/mobile-dto/shop-staff.ts). */
export type ShopTeam = {
  shop: { id: string; name: string };
  members: { userId: string; name: string | null; email: string | null; since: string }[];
  invites: { id: string; email: string; expiresAt: string }[];
  limit: number;
};

/** `POST partner/team`: yanit hesabin varligindan bagimsiz, her zaman davet. */
export type ShopTeamInviteResult = { success: true; kind?: "invited" };

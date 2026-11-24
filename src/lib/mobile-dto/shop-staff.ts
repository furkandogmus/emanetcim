type TeamSource = {
  members: { userId: string; createdAt: Date; user: { name: string | null; email: string | null } }[];
  invites: { id: string; email: string; expiresAt: Date; createdAt: Date }[];
  limit: number;
};

/** `GET partner/team`: sahibin ekip ekrani (web `/partner/team` ile ayni servis). */
export function toMobileShopTeam(shop: { id: string; name: string }, team: TeamSource) {
  return {
    shop: { id: shop.id, name: shop.name },
    members: team.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      since: m.createdAt.toISOString(),
    })),
    invites: team.invites.map((i) => ({ id: i.id, email: i.email, expiresAt: i.expiresAt.toISOString() })),
    limit: team.limit,
  };
}

/** Kullanicinin kendi silme talebi (`GET/POST /account/deletion-request`). */
export function toMobileDeletionRequest(
  r: { status: string; requestedAt: Date; dueAt: Date } | null,
  slaDays: number,
) {
  return {
    status: (r?.status ?? null) as "PENDING" | "COMPLETED" | "CANCELLED" | null,
    requestedAt: r?.requestedAt.toISOString() ?? null,
    dueAt: r?.dueAt.toISOString() ?? null,
    slaDays,
  };
}

type AdminDeletionSource = {
  id: string;
  role: string;
  status: string;
  note: string | null;
  requestedAt: Date;
  dueAt: Date;
  resolvedAt: Date | null;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
  blockers: { activeBookings: number; pendingPayouts: number };
  reopenShops: { id: string; name: string }[];
};

/** Yonetici silme kuyrugu satiri. */
export function toMobileAdminDeletionRequest(r: AdminDeletionSource) {
  return {
    id: r.id,
    role: r.role as "GUEST" | "PARTNER" | "ADMIN",
    status: r.status as "PENDING" | "COMPLETED" | "CANCELLED",
    note: r.note,
    requestedAt: r.requestedAt.toISOString(),
    dueAt: r.dueAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    user: { id: r.user.id, name: r.user.name ?? "", email: r.user.email, phone: r.user.phone },
    activeBookings: r.blockers.activeBookings,
    pendingPayouts: r.blockers.pendingPayouts,
    /** Iptalde yeniden acilacak dukkanlar (bu talebin kapattigi, o andan beri degismemis). */
    reopenShops: r.reopenShops.map((s) => ({ id: s.id, name: s.name })),
  };
}

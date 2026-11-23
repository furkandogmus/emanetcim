export type AccountDeletionStatus = "PENDING" | "COMPLETED" | "CANCELLED";

/** `toMobileDeletionRequest` (mobile-dto/account-deletion.ts): `GET/POST /account/deletion-request`. */
export type MyDeletionRequest = {
  status: AccountDeletionStatus | null;
  requestedAt: string | null;
  dueAt: string | null;
  slaDays: number;
  alreadyPending?: boolean;
};

/** `toMobileAdminDeletionRequest`: `GET /admin/account-deletions`. */
export type AdminDeletionRequest = {
  id: string;
  role: "GUEST" | "PARTNER" | "ADMIN";
  status: AccountDeletionStatus;
  note: string | null;
  requestedAt: string;
  dueAt: string;
  resolvedAt: string | null;
  user: { id: string; name: string; email: string | null; phone: string | null };
  activeBookings: number;
  pendingPayouts: number;
  reopenShops: { id: string; name: string }[];
};

export type AdminDeletionAction = "complete" | "cancel";

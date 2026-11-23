import type { Role } from "./user";

/** `/admin/users` satiri (sunucu `toMobileAdminUser`). */
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp?: string | null;
  role: Role;
  isBanned: boolean;
  isTest: boolean;
  /** Inceleme (App Review) hesabi: test dukkanlarini gorur ve rezerve eder. */
  reviewSandbox: boolean;
  bookingCount: number;
  shopCount: number;
  createdAt: string;
};

/* ===================== Admin kullanici yonetimi ===================== */

/** `GET /admin/users/[id]` (sunucu `toMobileAdminUserDetail`). */
export type AdminUserDetail = AdminUser & {
  emailVerified: boolean;
  hasPassword: boolean;
  /** Ikinci admin onayini bekleyen rol istegi. */
  pendingRole: Role | null;
  /** Silinmis (anonim) hesap: e-posta/sifre/silme islemleri kapali. */
  isAnonymized: boolean;
};

/** `POST /admin/users/[id]/role`. */
export type AdminRoleChangeResponse = { ok: true; status: "applied" | "pending_approval" };

/** `GET /admin/audit-log` satiri (sunucu `toMobileAdminAuditEntry`). */
export type AdminAuditEntry = {
  id: string;
  action: string;
  actorRole: string;
  actorUserId: string | null;
  actorLabel: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: string | null;
  createdAt: string;
};

export type AdminAuditPage = { entries: AdminAuditEntry[]; nextCursor: string | null; prefixes?: string[] };

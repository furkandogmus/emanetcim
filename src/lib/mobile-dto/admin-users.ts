import { isAnonymizedEmail } from "@/lib/anonymized-account";
import { toWhatsAppNumber } from "@/lib/whatsapp";

type AdminUserSource = Awaited<
  ReturnType<import("@/services/AdminUserService").AdminUserService["search"]>
>[number];

/** "Bu kullanici olarak gor" yalniz ADMIN olmayan, yasaksiz hesap icin mumkun (sunucu kurali). */
export function canViewAs(u: { role: string; isBanned: boolean }): boolean {
  return u.role !== "ADMIN" && !u.isBanned;
}

/** `admin/users`: arama satiri. */
export function toMobileAdminUser(u: AdminUserSource) {
  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? "",
    phone: u.phone ?? "",
    whatsapp: toWhatsAppNumber(u.phone),
    role: u.role,
    isBanned: u.isBanned,
    isTest: u.isTest,
    reviewSandbox: u.reviewSandbox,
    bookingCount: u._count.bookings,
    shopCount: u._count.shops,
    createdAt: u.createdAt.toISOString(),
  };
}

/* ===================== Admin kullanici yonetimi (detay, denetim kaydi) ===================== */

type AdminUserDetailSource = NonNullable<
  Awaited<ReturnType<import("@/services/AdminUserService").AdminUserService["getDetail"]>>
>;

/** `admin/users/[id]`: liste satiri + islem kapilari icin gereken durum. Sifre ozeti bile cikmaz. */
export function toMobileAdminUserDetail(u: AdminUserDetailSource) {
  return {
    ...toMobileAdminUser(u),
    emailVerified: u.emailVerified != null,
    hasPassword: u.passwordHash != null,
    // "IP engelle" neyi engelledigini gostersin; yalniz admin detayinda.
    lastIp: u.lastIp ?? null,
    // Ikinci admin onayini bekleyen rol istegi (web `/admin/role-approvals`).
    pendingRole: u.adminRoleChangeTargets?.requestedRole ?? null,
    // Silinmis hesap: e-posta `gdpr_...@invalid.local`, e-posta/silme islemleri anlamsiz.
    isAnonymized: isAnonymizedEmail(u.email),
  };
}

type AdminAuditSource = Awaited<
  ReturnType<import("@/services/AuditLogService").AuditLogService["listPage"]>
>["items"][number];

/** Mobilde metadata ozeti bu kadar karakterle sinirli; tamami webde. */
const AUDIT_METADATA_MAX = 600;

/** `admin/audit-log` satiri. */
export function toMobileAdminAuditEntry(e: AdminAuditSource) {
  const metadata = e.metadata == null ? null : JSON.stringify(e.metadata);
  return {
    id: e.id,
    action: e.action,
    actorRole: e.actorRole,
    actorUserId: e.actorUserId,
    actorLabel: e.actorLabel,
    entityType: e.entityType,
    entityId: e.entityId,
    metadata: metadata && metadata.length > AUDIT_METADATA_MAX ? `${metadata.slice(0, AUDIT_METADATA_MAX)}…` : metadata,
    createdAt: e.createdAt.toISOString(),
  };
}

type AdminRoleChangeRequestSource = {
  id: string;
  previousRole: string;
  requestedRole: string;
  createdAt: Date;
  requestedByUserId: string;
  targetUser: { id: string; name: string | null; email: string | null; role: string };
  requestedBy: { id: string; name: string | null; email: string | null };
};

/**
 * Mobil admin bekleyen rol degisikligi (`AdminUserService.listRoleChangeRequests`).
 * `isOwnRequest`: istegi bu admin actiysa onaylayamaz (servis kurali); dugme kapali gelir.
 */
export function toMobileAdminRoleChangeRequest(r: AdminRoleChangeRequestSource, viewerId: string) {
  return {
    id: r.id,
    previousRole: r.previousRole,
    requestedRole: r.requestedRole,
    createdAt: r.createdAt.toISOString(),
    target: { id: r.targetUser.id, name: r.targetUser.name, email: r.targetUser.email, role: r.targetUser.role },
    requestedBy: { id: r.requestedBy.id, name: r.requestedBy.name, email: r.requestedBy.email },
    isOwnRequest: r.requestedByUserId === viewerId,
  };
}

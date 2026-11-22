import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Yonetici kullanici islemleri -- web action'i ve mobil admin ucunun ORTAK
 * govdeleri: rol degisikligi (kendi rolu / son admin / ikinci onay), sifirlama ve
 * dogrulama e-postasi, yonetici silmesi (onay metni, gerekce, ayni silme kurallari)
 * ve denetim kaydi filtreleri.
 */

const m = vi.hoisted(() => {
  const ok = () => vi.fn().mockReturnValue(Promise.resolve({}));
  return {
    prisma: {
      user: { findUnique: vi.fn(), findMany: vi.fn(), update: ok(), count: vi.fn() },
      adminRoleChangeRequest: { create: ok() },
      auditLog: { findMany: vi.fn(), groupBy: vi.fn() },
      booking: { count: vi.fn() },
      session: { deleteMany: ok() },
      account: { deleteMany: ok() },
      review: { deleteMany: ok() },
      legalAcceptance: { deleteMany: ok() },
      pushSubscription: { deleteMany: ok() },
      mobilePushToken: { deleteMany: ok() },
      mobileInstall: { deleteMany: ok() },
      passwordResetCode: { deleteMany: ok() },
      verificationToken: { deleteMany: ok() },
      $transaction: vi.fn().mockResolvedValue([]),
    },
    audit: vi.fn(),
    requestPasswordReset: vi.fn(),
    sendVerificationEmail: vi.fn(),
    closeExpired: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: m.audit }));
vi.mock("@/services/auth/password-reset", () => ({ requestPasswordReset: m.requestPasswordReset }));
vi.mock("@/lib/mail", () => ({ sendVerificationEmail: m.sendVerificationEmail }));
vi.mock("@/lib/tokens", () => ({ generateVerificationToken: vi.fn(async () => ({ token: "tok" })) }));
vi.mock("@/services/booking/closure", () => ({ closeExpiredBookingsForGuest: m.closeExpired }));

import { adminUserService } from "@/services/AdminUserService";
import { accountPrivacyService, erasureConfirmMatches } from "@/services/AccountPrivacyService";
import { AuditLogService, auditLogService } from "@/services/AuditLogService";

const actor = { userId: "admin-1", ip: "203.0.113.5" };
const auditActions = () => m.audit.mock.calls.map((c) => c[0].action);

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.user.count.mockResolvedValue(2);
  m.requestPasswordReset.mockResolvedValue(undefined);
  m.sendVerificationEmail.mockResolvedValue(undefined);
  m.closeExpired.mockResolvedValue(0);
  m.prisma.booking.count.mockResolvedValue(0);
});

describe("AdminUserService.changeRole", () => {
  it("yonetici kendi rolunu degistiremez; hicbir sey yazilmaz", async () => {
    await expect(adminUserService.changeRole("admin-1", "GUEST", actor)).resolves.toEqual({
      ok: false,
      error: "cannot_change_self",
    });
    expect(m.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(m.prisma.user.update).not.toHaveBeenCalled();
  });

  it("son ADMIN dusurulemez", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ id: "admin-2", role: "ADMIN" });
    m.prisma.user.count.mockResolvedValue(1);
    await expect(adminUserService.changeRole("admin-2", "PARTNER", actor)).resolves.toEqual({
      ok: false,
      error: "cannot_demote_sole_admin",
    });
    expect(m.prisma.user.update).not.toHaveBeenCalled();
    expect(m.prisma.adminRoleChangeRequest.create).not.toHaveBeenCalled();
  });

  it("ayni rol same_role", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "PARTNER" });
    await expect(adminUserService.changeRole("u1", "PARTNER", actor)).resolves.toEqual({
      ok: false,
      error: "same_role",
    });
  });

  it("GUEST -> PARTNER aninda uygulanir, token'lar duser, denetim kaydi yazilir", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "GUEST" });
    await expect(adminUserService.changeRole("u1", "PARTNER", actor)).resolves.toEqual({
      ok: true,
      status: "applied",
    });
    expect(m.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { role: "PARTNER", tokenVersion: { increment: 1 } },
    });
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.role_update", actorUserId: "admin-1", entityId: "u1", ip: actor.ip }),
    );
  });

  it("birden fazla admin varken ADMIN gecisi ikinci onaya duser, rol yazilmaz", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "PARTNER" });
    await expect(adminUserService.changeRole("u1", "ADMIN", actor)).resolves.toEqual({
      ok: true,
      status: "pending_approval",
    });
    expect(m.prisma.user.update).not.toHaveBeenCalled();
    expect(m.prisma.adminRoleChangeRequest.create).toHaveBeenCalledWith({
      data: { targetUserId: "u1", previousRole: "PARTNER", requestedRole: "ADMIN", requestedByUserId: "admin-1" },
    });
    expect(auditActions()).toEqual(["user.role_change_request"]);
  });

  it("tek admin varken ADMIN'e yukseltme aninda uygulanir", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "GUEST" });
    m.prisma.user.count.mockResolvedValue(1);
    await expect(adminUserService.changeRole("u1", "ADMIN", actor)).resolves.toEqual({ ok: true, status: "applied" });
    expect(m.prisma.adminRoleChangeRequest.create).not.toHaveBeenCalled();
  });

  it("bekleyen istek varsa pending_exists", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "PARTNER" });
    m.prisma.adminRoleChangeRequest.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }),
    );
    await expect(adminUserService.changeRole("u1", "ADMIN", actor)).resolves.toEqual({
      ok: false,
      error: "pending_exists",
    });
    expect(m.audit).not.toHaveBeenCalled();
  });
});

describe("AdminUserService e-posta islemleri", () => {
  it("sifirlama normal govdeye gider (kullanicinin e-postasi), denetim kaydi yazilir", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ email: "ada@example.com" });
    await expect(adminUserService.sendPasswordReset("u1", actor, "en")).resolves.toEqual({ ok: true });
    expect(m.requestPasswordReset).toHaveBeenCalledWith("ada@example.com", "en");
    expect(auditActions()).toEqual(["user.password_reset_sent_by_admin"]);
  });

  it.each([[null], ["gdpr_abc@invalid.local"]])("e-postasi olmayan hesap (%s) no_email", async (email) => {
    m.prisma.user.findUnique.mockResolvedValue({ email });
    await expect(adminUserService.sendPasswordReset("u1", actor, "tr")).resolves.toEqual({
      ok: false,
      error: "no_email",
    });
    expect(m.requestPasswordReset).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("olmayan kullanici not_found", async () => {
    m.prisma.user.findUnique.mockResolvedValue(null);
    await expect(adminUserService.sendPasswordReset("yok", actor, "tr")).resolves.toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("dogrulanmis hesaba dogrulama e-postasi gitmez", async () => {
    m.prisma.user.findUnique
      .mockResolvedValueOnce({ email: "ada@example.com" })
      .mockResolvedValueOnce({ id: "u1", emailVerified: new Date() });
    await expect(adminUserService.resendVerificationForUser("u1", actor, "tr")).resolves.toEqual({
      ok: false,
      error: "already_verified",
    });
    expect(m.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("dogrulama e-postasi gider ve denetim kaydi yazilir", async () => {
    m.prisma.user.findUnique
      .mockResolvedValueOnce({ email: "ada@example.com" })
      .mockResolvedValueOnce({ id: "u1", emailVerified: null });
    await expect(adminUserService.resendVerificationForUser("u1", actor, "de")).resolves.toEqual({ ok: true });
    expect(m.sendVerificationEmail).toHaveBeenCalledWith("ada@example.com", "tok", "de");
    expect(auditActions()).toEqual(["user.verification_resent"]);
  });

  it("gecersiz e-posta bicimi token uretmez (web BUG-08)", async () => {
    await expect(adminUserService.resendVerificationEmail("degil", actor, "tr")).resolves.toEqual({
      ok: false,
      error: "invalid_email",
    });
    expect(m.prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("AccountPrivacyService.anonymizeByAdmin", () => {
  const guest = { id: "g1", role: "GUEST", email: "Ada@Example.com", phone: "5551112233" };
  const run = (over: Partial<{ targetUserId: string; confirm: string; reason: string }> = {}) =>
    accountPrivacyService.anonymizeByAdmin({
      targetUserId: "g1",
      actor: { userId: "admin-1", ip: null },
      confirm: "ada@example.com",
      reason: "Kullanici e-postayla silme istedi",
      ...over,
    });

  beforeEach(() => {
    m.prisma.user.findUnique.mockResolvedValue(guest);
  });

  it("onay metni hesabin e-postasi/telefonu degilse hicbir sey silinmez", async () => {
    await expect(run({ confirm: "baska@example.com" })).resolves.toEqual({ ok: false, reason: "confirm_mismatch" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("telefonla onay 0/+90/bosluk farklarini yok sayar", () => {
    expect(erasureConfirmMatches("+90 555 111 22 33", guest)).toBe(true);
    expect(erasureConfirmMatches("05551112233", guest)).toBe(true);
    expect(erasureConfirmMatches("5551112234", guest)).toBe(false);
    expect(erasureConfirmMatches("  ", { email: null, phone: null })).toBe(false);
  });

  it("yonetici kendini silemez", async () => {
    await expect(run({ targetUserId: "admin-1" })).resolves.toEqual({ ok: false, reason: "cannot_delete_self" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("gerekce zorunlu", async () => {
    await expect(run({ reason: "  abc " })).resolves.toEqual({ ok: false, reason: "invalid_reason" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("kendi silmesiyle ayni kural: yalnizca misafir", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ ...guest, role: "PARTNER" });
    await expect(run()).resolves.toEqual({ ok: false, reason: "not_guest" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("kendi silmesiyle ayni kural: aktif rezervasyon varken silinmez", async () => {
    m.prisma.booking.count.mockResolvedValue(1);
    await expect(run()).resolves.toEqual({ ok: false, reason: "active_bookings" });
    expect(m.closeExpired).not.toHaveBeenCalled();
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("zaten anonim hesap tekrar islenmez", async () => {
    m.prisma.user.findUnique.mockResolvedValue({ ...guest, email: "gdpr_x@invalid.local" });
    await expect(run()).resolves.toEqual({ ok: false, reason: "already_anonymized" });
  });

  it("basarili silme ayni silme listesini calistirir ve gerekceyi denetim kaydina yazar", async () => {
    await expect(run()).resolves.toEqual({ ok: true });
    expect(m.closeExpired).toHaveBeenCalledWith("g1", expect.any(Date));
    expect(m.prisma.$transaction).toHaveBeenCalled();
    expect(m.prisma.mobilePushToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "g1" } });
    expect(m.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tokenVersion: { increment: 1 }, phone: null }) }),
    );
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "account.anonymize_by_admin",
        actorUserId: "admin-1",
        actorRole: "ADMIN",
        entityId: "g1",
        metadata: { reason: "Kullanici e-postayla silme istedi" },
      }),
    );
  });
});

describe("AuditLogService", () => {
  beforeEach(() => {
    m.prisma.auditLog.findMany.mockResolvedValue([
      { id: "a1", actorUserId: "admin-1", action: "user.role_update", createdAt: new Date() },
    ]);
    m.prisma.user.findMany.mockResolvedValue([{ id: "admin-1", name: null, email: "boss@example.com" }]);
  });

  it("onek ve kullanici filtresi sunucuda uygulanir, aktor tek sorguda cozulur", async () => {
    const page = await auditLogService.listPage({ actionPrefix: "user.", userId: "u1" }, { take: 30 });
    const { where, take } = m.prisma.auditLog.findMany.mock.calls[0][0];
    expect(where.AND).toEqual([
      { action: { startsWith: "user." } },
      { OR: [{ actorUserId: "u1" }, { entityType: "User", entityId: "u1" }] },
    ]);
    expect(take).toBe(31);
    expect(m.prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(page.items[0].actorLabel).toBe("boss@example.com");
    expect(page.nextCursor).toBeNull();
  });

  it("web filtreleri (tam eylem, varlik, serbest arama) korunur", async () => {
    await auditLogService.listPage({ action: "user.delete", entityType: "User", q: " 203.0 " });
    const { where } = m.prisma.auditLog.findMany.mock.calls[0][0];
    expect(where.AND).toEqual([
      { action: "user.delete" },
      { entityType: "User" },
      {
        OR: [
          { actorUserId: { contains: "203.0", mode: "insensitive" } },
          { entityId: { contains: "203.0", mode: "insensitive" } },
          { ip: { contains: "203.0", mode: "insensitive" } },
        ],
      },
    ]);
  });

  it("onek listesi ~10 dakika onbellekte, sonra yeniden sorulur", async () => {
    m.prisma.auditLog.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
      by[0] === "action" ? [{ action: "user.delete" }] : [],
    );
    const svc = new AuditLogService();
    expect(await svc.cachedActionPrefixes(0)).toEqual(["user."]);
    await svc.cachedActionPrefixes(9 * 60 * 1000);
    expect(m.prisma.auditLog.groupBy).toHaveBeenCalledTimes(2); // tek filterOptions = 2 groupBy
    await svc.cachedActionPrefixes(11 * 60 * 1000);
    expect(m.prisma.auditLog.groupBy).toHaveBeenCalledTimes(4);
  });

  it("onekler veriden turer", async () => {
    m.prisma.auditLog.groupBy
      .mockResolvedValueOnce([{ action: "user.delete" }, { action: "user.role_update" }, { action: "shop.approve" }])
      .mockResolvedValueOnce([{ entityType: "User" }, { entityType: null }]);
    const o = await auditLogService.filterOptions();
    expect(o.actionPrefixes).toEqual(["user.", "shop."]);
    expect(o.entityTypes).toEqual(["User"]);
  });
});

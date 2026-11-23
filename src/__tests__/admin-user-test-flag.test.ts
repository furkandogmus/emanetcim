import { describe, it, expect, vi, beforeEach } from "vitest";

/** `AdminUserService.setTestAccount`: inceleme kum havuzu bayragi, denetim kaydiyla. */
const { db, audit } = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn(), update: vi.fn() } },
  audit: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: audit }));
vi.mock("@/lib/mail", () => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/services/auth/password-reset", () => ({ requestPasswordReset: vi.fn() }));

import { adminUserService } from "@/services/AdminUserService";

const actor = { userId: "admin-1", ip: null };

beforeEach(() => vi.clearAllMocks());

describe("setTestAccount", () => {
  it("misafiri test hesabi yapar ve denetim kaydi yazar", async () => {
    db.user.findUnique.mockResolvedValue({ id: "g1", role: "GUEST", isTest: false });
    expect(await adminUserService.setTestAccount("g1", true, actor)).toEqual({ ok: true });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "g1" }, data: { isTest: true } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "user.test_toggle", entityId: "g1", metadata: { isTest: true } }));
  });

  it("yonetici test hesabi yapilamaz", async () => {
    db.user.findUnique.mockResolvedValue({ id: "a2", role: "ADMIN", isTest: false });
    expect(await adminUserService.setTestAccount("a2", true, actor)).toEqual({ ok: false, error: "cannot_flag_admin" });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("bilinmeyen kullanici: not_found; degisiklik yoksa yazmaz", async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect(await adminUserService.setTestAccount("x", true, actor)).toEqual({ ok: false, error: "not_found" });
    db.user.findUnique.mockResolvedValue({ id: "g1", role: "GUEST", isTest: true });
    expect(await adminUserService.setTestAccount("g1", true, actor)).toEqual({ ok: true });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});

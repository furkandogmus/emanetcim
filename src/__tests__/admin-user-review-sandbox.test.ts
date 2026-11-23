import { describe, it, expect, vi, beforeEach } from "vitest";

/** `AdminUserService.setReviewSandbox`: inceleme (App Review) bayragi, denetim kaydiyla. */
const { db, audit } = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn(), update: vi.fn() } },
  audit: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: audit }));
vi.mock("@/lib/mail", () => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/services/auth/password-reset", () => ({ requestPasswordReset: vi.fn() }));

import { Role } from "@prisma/client";
import { adminUserService } from "@/services/AdminUserService";
import { roleChangeData } from "@/lib/role-change-data";

const actor = { userId: "admin-1", ip: null };

beforeEach(() => vi.clearAllMocks());

describe("roleChangeData", () => {
  it("ADMIN'e yukselen hesabin inceleme bayragi kalkar; diger rollerde dokunulmaz", () => {
    expect(roleChangeData(Role.ADMIN)).toMatchObject({ role: Role.ADMIN, reviewSandbox: false });
    expect(roleChangeData(Role.PARTNER)).not.toHaveProperty("reviewSandbox");
  });
});

describe("setReviewSandbox", () => {
  it("misafiri inceleme hesabi yapar ve denetim kaydi yazar", async () => {
    db.user.findUnique.mockResolvedValue({ id: "g1", role: "GUEST", reviewSandbox: false });
    expect(await adminUserService.setReviewSandbox("g1", true, actor)).toEqual({ ok: true });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "g1" }, data: { reviewSandbox: true } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "user.review_sandbox_toggle", entityId: "g1", metadata: { reviewSandbox: true } }));
  });

  it("yonetici inceleme hesabi yapilamaz", async () => {
    db.user.findUnique.mockResolvedValue({ id: "a2", role: "ADMIN", reviewSandbox: false });
    expect(await adminUserService.setReviewSandbox("a2", true, actor)).toEqual({ ok: false, error: "cannot_flag_admin" });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("bilinmeyen kullanici: not_found; degisiklik yoksa yazmaz", async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect(await adminUserService.setReviewSandbox("x", true, actor)).toEqual({ ok: false, error: "not_found" });
    db.user.findUnique.mockResolvedValue({ id: "g1", role: "GUEST", reviewSandbox: true });
    expect(await adminUserService.setReviewSandbox("g1", true, actor)).toEqual({ ok: true });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});

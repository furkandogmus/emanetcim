import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ adminRoleChangeRequest: { findUnique: vi.fn(), deleteMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ default: db }));
const audit = vi.hoisted(() => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/audit-log", () => audit);
vi.mock("@/lib/mail", () => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/services/auth/password-reset", () => ({ requestPasswordReset: vi.fn() }));

import { adminUserService } from "@/services/AdminUserService";

const ROW = { id: "r1", targetUserId: "u1", previousRole: "PARTNER", requestedRole: "ADMIN", requestedByUserId: "a2" };
const actor = { userId: "a1", ip: null };

beforeEach(() => {
  vi.clearAllMocks();
  db.adminRoleChangeRequest.findUnique.mockResolvedValue(ROW);
});

describe("AdminUserService.cancelRoleChange", () => {
  it("istegi siler ve denetim kaydi yazar", async () => {
    db.adminRoleChangeRequest.deleteMany.mockResolvedValue({ count: 1 });
    await expect(adminUserService.cancelRoleChange("r1", actor)).resolves.toEqual({ ok: true });
    expect(audit.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "user.role_change_request_cancel" }));
  });

  it("ayni anda baska admin sildiyse not_found doner (500 degil), denetim kaydi yazilmaz", async () => {
    db.adminRoleChangeRequest.deleteMany.mockResolvedValue({ count: 0 });
    await expect(adminUserService.cancelRoleChange("r1", actor)).resolves.toEqual({ ok: false, error: "not_found" });
    expect(audit.writeAuditLog).not.toHaveBeenCalled();
  });

  it("istek yoksa not_found", async () => {
    db.adminRoleChangeRequest.findUnique.mockResolvedValue(null);
    await expect(adminUserService.cancelRoleChange("r1", actor)).resolves.toEqual({ ok: false, error: "not_found" });
    expect(db.adminRoleChangeRequest.deleteMany).not.toHaveBeenCalled();
  });
});

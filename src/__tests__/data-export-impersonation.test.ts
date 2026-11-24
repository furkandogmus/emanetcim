import { describe, it, expect, vi, beforeEach } from "vitest";

/** Web veri disa aktarimi (GET indirme, POST e-posta) "olarak goruntule" oturumunda kapali. */
const m = vi.hoisted(() => ({ auth: vi.fn(), build: vi.fn(), email: vi.fn() }));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/get-ip", () => ({ getClientIp: vi.fn().mockResolvedValue("203.0.113.5") }));
vi.mock("@/services/AccountDataExportService", () => ({
  accountDataExportService: { buildExport: m.build, emailExport: m.email },
}));

import { GET, POST } from "@/app/api/account/data-export/route";

const IMP = { user: { id: "t-1", role: "GUEST" }, impersonation: { adminId: "a-1", expiresAt: "2026-11-24T10:30:00Z" } };
const STALE = { user: { id: "a-1", role: "ADMIN" }, impersonation: { stale: true, expiresAt: null } };

describe("data-export goruntuleme kilidi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET ve POST goruntulemede ve stale oturumda 403, servise gitmez", async () => {
    for (const session of [IMP, STALE]) {
      m.auth.mockResolvedValue(session);
      expect((await GET()).status).toBe(403);
      const post = await POST(new Request("https://example.test/api/account/data-export", { method: "POST", body: "{}" }));
      expect(post.status).toBe(403);
    }
    expect(m.build).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });
});

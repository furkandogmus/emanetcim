import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Goruntuleme oturumunda giris kimligi (e-posta, telefon) degistirilemez;
 * ad ve sifre belirleme (destek senaryosu) serbest kalir.
 */
const { mockAuth, mockUpdatePhone, mockDb } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUpdatePhone: vi.fn(),
  mockDb: { user: { update: vi.fn(), findUnique: vi.fn() } },
}));

vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockAuth,
}));
vi.mock("@/lib/db", () => ({ default: mockDb }));
vi.mock("@/services/PartnerProfileService", () => ({
  partnerProfileService: { updatePhone: mockUpdatePhone },
}));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { PUT as putMe } from "@/app/api/mobile/auth/me/route";
import { PUT as putPartnerPhone } from "@/app/api/mobile/partner/phone/route";

const impersonated = { user: { id: "u1", role: "PARTNER", email: "a@b.co", impersonatedBy: "adm-1" } };
const normal = { user: { id: "u1", role: "PARTNER", email: "a@b.co" } };

function req(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("goruntuleme oturumunda kimlik kilidi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdatePhone.mockResolvedValue({ ok: true, phone: "5321234567" });
    mockDb.user.update.mockResolvedValue({});
  });

  it("PUT /auth/me telefon degisimi 403 not_allowed_while_impersonating", async () => {
    mockAuth.mockResolvedValue(impersonated);
    const res = await putMe(req("/api/mobile/auth/me", { phone: "5321234567" }));
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: "not_allowed_while_impersonating" });
    expect(mockUpdatePhone).not.toHaveBeenCalled();
  });

  it("PUT /auth/me e-posta girisimi 403", async () => {
    mockAuth.mockResolvedValue(impersonated);
    const res = await putMe(req("/api/mobile/auth/me", { email: "x@y.co" }));
    expect(res?.status).toBe(403);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("PUT /partner/phone 403", async () => {
    mockAuth.mockResolvedValue(impersonated);
    const res = await putPartnerPhone(req("/api/mobile/partner/phone", { phone: "5321234567" }));
    expect(res?.status).toBe(403);
    expect(mockUpdatePhone).not.toHaveBeenCalled();
  });

  it("goruntuleme oturumunda ad degisimi serbest", async () => {
    mockAuth.mockResolvedValue(impersonated);
    const res = await putMe(req("/api/mobile/auth/me", { name: "Yeni Ad" }));
    expect(res?.status).toBe(200);
    expect(mockDb.user.update).toHaveBeenCalled();
  });

  it("normal kullanici etkilenmez", async () => {
    mockAuth.mockResolvedValue(normal);
    const a = await putMe(req("/api/mobile/auth/me", { phone: "5321234567" }));
    expect(a?.status).toBe(200);
    const b = await putPartnerPhone(req("/api/mobile/partner/phone", { phone: "5321234567" }));
    expect(b?.status).toBe(200);
    expect(mockUpdatePhone).toHaveBeenCalledTimes(2);
  });
});

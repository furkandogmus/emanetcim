import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/** Silme talebi tasiyicilari: mobil uc, yonetici uclari ve web action'i ayni servise gider. */

const m = vi.hoisted(() => ({
  requireMobileUser: vi.fn(),
  auth: vi.fn(),
  svc: {
    requestDeletion: vi.fn(),
    getDeletionRequest: vi.fn(),
    listDeletionRequests: vi.fn(),
    completeDeletionRequest: vi.fn(),
    cancelDeletionRequest: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: m.requireMobileUser,
}));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/lib/client-ip", async (orig) => ({
  ...(await orig<typeof import("@/lib/client-ip")>()),
  getClientIpOrNull: vi.fn(async () => null),
}));
vi.mock("@/services/AccountPrivacyService", async (orig) => ({
  ...(await orig<typeof import("@/services/AccountPrivacyService")>()),
  accountPrivacyService: m.svc,
}));

import * as mine from "@/app/api/mobile/account/deletion-request/route";
import * as adminList from "@/app/api/mobile/admin/account-deletions/route";
import * as adminAction from "@/app/api/mobile/admin/account-deletions/[id]/[action]/route";
import { requestAccountDeletionAction } from "@/actions/account-privacy";
import { completeAccountDeletionAction } from "@/actions/account-deletion-admin";

const DUE = new Date("2026-12-23T10:00:00Z");
const PARTNER = { id: "p1", role: "PARTNER", tokenVersion: 0 };
const ADMIN = { id: "a1", role: "ADMIN", tokenVersion: 0 };

function post(url: string, body?: unknown) {
  return new NextRequest(url, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.svc.getDeletionRequest.mockResolvedValue({ status: "PENDING", requestedAt: new Date(), dueAt: DUE });
});

describe("POST /api/mobile/account/deletion-request", () => {
  it("esnaf talebi acilir ve son gun + gun sayisi doner", async () => {
    m.requireMobileUser.mockResolvedValue({ user: PARTNER });
    m.svc.requestDeletion.mockResolvedValue({ ok: true, alreadyPending: false, dueAt: DUE, slaDays: 30 });
    const res = await mine.POST(post("https://x/api/mobile/account/deletion-request", { locale: "tr" }));
    expect(res!.status).toBe(200);
    expect(await res!.json()).toMatchObject({ status: "PENDING", dueAt: DUE.toISOString(), slaDays: 30, alreadyPending: false });
    expect(m.svc.requestDeletion).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "p1", role: "PARTNER", locale: "tr", auditAction: "account.deletion_requested_mobile" }),
    );
  });

  it("son yonetici 409 last_admin alir; yonetici goruntulemesinde talep acilamaz", async () => {
    m.requireMobileUser.mockResolvedValue({ user: ADMIN });
    m.svc.requestDeletion.mockResolvedValue({ ok: false, reason: "last_admin" });
    const res = await mine.POST(post("https://x/api/mobile/account/deletion-request"));
    expect(res!.status).toBe(409);
    expect(await res!.json()).toEqual({ error: "last_admin" });

    m.requireMobileUser.mockResolvedValue({ user: { ...PARTNER, impersonatedBy: "a1" } });
    const blocked = await mine.POST(post("https://x/api/mobile/account/deletion-request"));
    expect(blocked!.status).toBe(403);
  });
});

describe("yonetici uclari", () => {
  it("esnaf listeyi goremez, tamamlayamaz", async () => {
    m.requireMobileUser.mockResolvedValue({ user: PARTNER });
    expect((await adminList.GET(new NextRequest("https://x/api/mobile/admin/account-deletions")))!.status).toBe(403);
    const res = await adminAction.POST(post("https://x/api/mobile/admin/account-deletions/r1/complete"), {
      params: Promise.resolve({ id: "r1", action: "complete" }),
    });
    expect(res!.status).toBe(403);
    expect(m.svc.completeDeletionRequest).not.toHaveBeenCalled();
  });

  it("tamamlama engeli 409 ile alan koduna cevrilir; bilinmeyen eylem 404", async () => {
    m.requireMobileUser.mockResolvedValue({ user: ADMIN });
    m.svc.completeDeletionRequest.mockResolvedValue({ ok: false, reason: "pending_payouts" });
    const res = await adminAction.POST(post("https://x/api/mobile/admin/account-deletions/r1/complete"), {
      params: Promise.resolve({ id: "r1", action: "complete" }),
    });
    expect(res!.status).toBe(409);
    expect(await res!.json()).toEqual({ error: "pending_payouts" });

    const bad = await adminAction.POST(post("https://x/api/mobile/admin/account-deletions/r1/nuke"), {
      params: Promise.resolve({ id: "r1", action: "nuke" }),
    });
    expect(bad!.status).toBe(404);
  });

  it("iptal gerekceyle servise gider", async () => {
    m.requireMobileUser.mockResolvedValue({ user: ADMIN });
    m.svc.cancelDeletionRequest.mockResolvedValue({ ok: true });
    const res = await adminAction.POST(post("https://x/api/mobile/admin/account-deletions/r1/cancel", { reason: "vazgecti" }), {
      params: Promise.resolve({ id: "r1", action: "cancel" }),
    });
    expect(res!.status).toBe(200);
    expect(m.svc.cancelDeletionRequest).toHaveBeenCalledWith(expect.objectContaining({ requestId: "r1", reason: "vazgecti" }));
  });
});

describe("web action'lari", () => {
  it("esnaf web'den de ayni servisle talep acar", async () => {
    m.auth.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
    m.svc.requestDeletion.mockResolvedValue({ ok: true, alreadyPending: false, dueAt: DUE, slaDays: 30 });
    await expect(requestAccountDeletionAction({ locale: "de" })).resolves.toEqual({
      success: true,
      dueAtIso: DUE.toISOString(),
      slaDays: 30,
      alreadyPending: false,
    });
    expect(m.svc.requestDeletion).toHaveBeenCalledWith(expect.objectContaining({ userId: "p1", role: "PARTNER", locale: "de" }));
  });

  it("tamamlama yalnizca yonetici", async () => {
    m.auth.mockResolvedValue({ user: { id: "p1", role: "PARTNER" } });
    await expect(completeAccountDeletionAction("r1")).resolves.toEqual({
      success: false,
      error: "Errors.notAuthorizedAdmin",
    });
    expect(m.svc.completeDeletionRequest).not.toHaveBeenCalled();
  });
});

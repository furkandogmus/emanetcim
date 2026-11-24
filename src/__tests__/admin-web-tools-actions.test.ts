import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Web yonetici araclari (D3): duyuru, KVKK silmesi, inceleme hesabi. Govdeler mobil
 * uclarla ortak servislerde; burada yetki kapisi ve servise dogru girdi sabitleniyor.
 */

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  preview: vi.fn(),
  test: vi.fn(),
  create: vi.fn(),
  start: vi.fn(),
  anonymize: vi.fn(),
  sandbox: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/client-ip", () => ({ getClientIpOrNull: vi.fn().mockResolvedValue("203.0.113.9") }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
vi.mock("@/services/BroadcastService", () => ({
  previewBroadcast: m.preview,
  sendBroadcastTest: m.test,
  createBroadcast: m.create,
  startBroadcastDelivery: m.start,
}));
vi.mock("@/services/AccountPrivacyService", () => ({ accountPrivacyService: { anonymizeByAdmin: m.anonymize } }));
vi.mock("@/services/AdminUserService", () => ({ adminUserService: { setReviewSandbox: m.sandbox } }));

import { previewBroadcastAction, sendBroadcastAction, sendBroadcastTestAction } from "@/actions/admin-broadcast";
import { adminAnonymizeUserAction, adminSetReviewSandboxAction } from "@/actions/admin-user-tools";

const ADMIN = { user: { id: "11111111-1111-4111-8111-111111111111", role: "ADMIN" } };
const USER_ID = "22222222-2222-4222-8222-222222222222";
const CONTENT = { titleTr: "Bakim", bodyTr: "Gece 02:00-03:00 bakim var.", titleEn: "", bodyEn: "" };

describe("admin-broadcast actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue(ADMIN);
  });

  it("admin olmayana kapali; servise hic gitmez", async () => {
    m.auth.mockResolvedValue({ user: { id: "p", role: "PARTNER" } });
    expect((await previewBroadcastAction("ALL")).ok).toBe(false);
    expect((await sendBroadcastTestAction(CONTENT)).ok).toBe(false);
    expect((await sendBroadcastAction({ audience: "ALL", ...CONTENT, reason: "Bakim duyurusu" })).ok).toBe(false);
    expect(m.preview).not.toHaveBeenCalled();
    expect(m.test).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("gonderim servise yalniz bilinen alanlarla gider ve teslimi baslatir", async () => {
    m.create.mockResolvedValue({ ok: true, id: "b1", devices: 12 });
    const r = await sendBroadcastAction({ audience: "GUESTS", ...CONTENT, reason: "Bakim duyurusu", createdById: "x" });
    expect(r).toEqual({ ok: true, id: "b1", devices: 12 });
    expect(m.create).toHaveBeenCalledWith(
      { id: ADMIN.user.id },
      { audience: "GUESTS", ...CONTENT, reason: "Bakim duyurusu" },
      { ip: "203.0.113.9" },
    );
    expect(m.start).toHaveBeenCalledWith("b1");
  });

  it("10 dk siniri: kalan sure istemciye doner, teslim baslamaz", async () => {
    m.create.mockResolvedValue({ ok: false, code: "too_soon", retryAfterSeconds: 240 });
    const r = await sendBroadcastAction({ audience: "ALL", ...CONTENT, reason: "Bakim duyurusu" });
    expect(r).toEqual({ ok: false, error: "too_soon", retryAfterSeconds: 240 });
    expect(m.start).not.toHaveBeenCalled();
  });

  it("test yalniz cagiran admine; onizleme sayilari doner", async () => {
    m.test.mockResolvedValue({ ok: true, devices: 0 });
    expect(await sendBroadcastTestAction(CONTENT)).toEqual({ ok: true, devices: 0 });
    expect(m.test).toHaveBeenCalledWith({ id: ADMIN.user.id }, CONTENT);
    m.preview.mockResolvedValue({ ok: true, users: 3, devices: 5 });
    expect(await previewBroadcastAction("PARTNERS")).toEqual({ ok: true, users: 3, devices: 5 });
  });
});

describe("admin-user-tools actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue(ADMIN);
  });

  it("KVKK silmesi: admin degilse kapali, gecersiz girdi servise gitmez", async () => {
    m.auth.mockResolvedValue({ user: { id: "g", role: "GUEST" } });
    expect((await adminAnonymizeUserAction({ userId: USER_ID, confirm: "a", reason: "abcde" })).ok).toBe(false);
    m.auth.mockResolvedValue(ADMIN);
    expect(await adminAnonymizeUserAction({ userId: "not-uuid", confirm: "a", reason: "abcde" })).toEqual({
      ok: false,
      error: "Errors.invalidData",
    });
    expect(m.anonymize).not.toHaveBeenCalled();
  });

  it("KVKK silmesi: servis kodu aynen doner (onay uyusmazligi)", async () => {
    m.anonymize.mockResolvedValue({ ok: false, reason: "confirm_mismatch" });
    const r = await adminAnonymizeUserAction({ userId: USER_ID, confirm: "x@example.test", reason: "Kullanici istedi" });
    expect(r).toEqual({ ok: false, error: "confirm_mismatch" });
    expect(m.anonymize).toHaveBeenCalledWith({
      targetUserId: USER_ID,
      actor: { userId: ADMIN.user.id, ip: "203.0.113.9" },
      confirm: "x@example.test",
      reason: "Kullanici istedi",
    });
  });

  it("inceleme hesabi: servis cagrilir, admin hedef kodu doner", async () => {
    m.sandbox.mockResolvedValueOnce({ ok: true });
    expect(await adminSetReviewSandboxAction({ userId: USER_ID, reviewSandbox: true })).toEqual({ ok: true });
    expect(m.sandbox).toHaveBeenCalledWith(USER_ID, true, { userId: ADMIN.user.id, ip: "203.0.113.9" });
    m.sandbox.mockResolvedValueOnce({ ok: false, error: "cannot_flag_admin" });
    expect(await adminSetReviewSandboxAction({ userId: USER_ID, reviewSandbox: true })).toEqual({
      ok: false,
      error: "cannot_flag_admin",
    });
  });
});

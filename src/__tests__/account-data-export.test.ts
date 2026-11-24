import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/** KVKK disa aktarma: servis (icerik, maske, 24 saat siniri) ve web + mobil tasiyicilar. */

const m = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn() },
    booking: { findMany: vi.fn() },
    review: { findMany: vi.fn() },
    legalAcceptance: { findMany: vi.fn() },
    shop: { findMany: vi.fn() },
    affiliate: { findUnique: vi.fn() },
    accountDeletionRequest: { findUnique: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  send: vi.fn(),
  rateLimit: vi.fn(),
  auth: vi.fn(),
  requireMobileUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: m.db }));
vi.mock("@/lib/mail", () => ({ sendDataExportEmail: m.send }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/get-ip", () => ({ getClientIp: vi.fn(async () => "127.0.0.1") }));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: m.requireMobileUser,
}));

import { accountDataExportService, DATA_EXPORT_EMAIL_WINDOW_MS } from "@/services/AccountDataExportService";
import * as webRoute from "@/app/api/account/data-export/route";
import * as mobileRoute from "@/app/api/mobile/account/data-export/route";

const NOW = new Date("2026-11-24T10:00:00.000Z");
const USER = {
  id: "u1234567-aaaa",
  role: "PARTNER",
  email: "esnaf@example.test",
  emailVerified: new Date("2026-10-01T00:00:00Z"),
  phone: "5320000000",
  name: "Ornek Esnaf",
  image: null,
  referralCode: null,
  createdAt: NOW,
  updatedAt: NOW,
  accounts: [{ provider: "google" }, { provider: "google" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  m.db.user.findUnique.mockResolvedValue(USER);
  m.db.booking.findMany.mockResolvedValue([]);
  m.db.review.findMany.mockResolvedValue([]);
  m.db.legalAcceptance.findMany.mockResolvedValue([]);
  m.db.shop.findMany.mockResolvedValue([
    {
      id: "s1",
      name: "Ornek Dukkan",
      merchantProfile: { legalType: "INDIVIDUAL", tckn: "12345678901", vkn: null, iban: "TR00 0000 0000 0000 0000 0012 34" },
    },
  ]);
  m.db.affiliate.findUnique.mockResolvedValue(null);
  m.db.accountDeletionRequest.findUnique.mockResolvedValue(null);
  m.db.auditLog.findFirst.mockResolvedValue(null);
  m.db.auditLog.create.mockResolvedValue({ id: "claim1" });
  m.db.auditLog.update.mockResolvedValue({});
  m.db.$executeRaw.mockResolvedValue(1);
  m.db.$transaction.mockImplementation(async (fn: (tx: typeof m.db) => unknown) => fn(m.db));
  m.rateLimit.mockResolvedValue(true);
  m.send.mockResolvedValue(true);
});

describe("buildExport", () => {
  it("esnafin dukkani ve odeme profili gelir; IBAN/TCKN son 4 haneyle maskelenir", async () => {
    const data = await accountDataExportService.buildExport("u1", NOW);
    expect(data!.user.signInProviders).toEqual(["google"]);
    const mp = data!.shops[0].payoutProfile!;
    expect(mp.tckn).toBe("*******8901");
    expect(mp.iban).toMatch(/^\*+1234$/);
    expect(mp.vkn).toBeNull();
    expect(data!.exportedAt).toBe(NOW.toISOString());
  });
});

describe("emailExport", () => {
  const call = () =>
    accountDataExportService.emailExport({ userId: USER.id, role: "PARTNER", locale: "de", ip: null, channel: "mobile", now: NOW });

  it("kayit kilit altinda gonderimden ONCE sahiplenilir, basarida sent olur", async () => {
    m.send.mockImplementation(async () => {
      expect(m.db.auditLog.create).toHaveBeenCalled();
      return true;
    });
    await expect(call()).resolves.toEqual({ ok: true, email: USER.email });
    expect(String(m.db.$executeRaw.mock.calls[0][0])).toContain("pg_advisory_xact_lock");
    expect(m.db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "account.data_export_emailed", entityId: USER.id, metadata: { channel: "mobile", status: "sending" } }),
      }),
    );
    expect(m.send).toHaveBeenCalledWith(
      expect.objectContaining({ email: USER.email, locale: "de", filename: "bagajpark-data-u1234567.json" }),
    );
    expect(JSON.parse(m.send.mock.calls[0][0].json).user.id).toBe(USER.id);
    expect(m.db.auditLog.update).toHaveBeenCalledWith({ where: { id: "claim1" }, data: { metadata: { channel: "mobile", status: "sent" } } });
  });

  it("24 saat icinde gonderilmis istek rate_limited ve ne zaman acilacagini soyler", async () => {
    const last = new Date(NOW.getTime() - 60 * 60 * 1000);
    m.db.auditLog.findFirst.mockResolvedValue({ createdAt: last, metadata: { status: "sent" } });
    const r = await call();
    expect(r).toEqual({ ok: false, reason: "rate_limited", retryAt: new Date(last.getTime() + DATA_EXPORT_EMAIL_WINDOW_MS) });
    expect(m.send).not.toHaveBeenCalled();
    expect(m.db.auditLog.create).not.toHaveBeenCalled();
  });

  it("suren gonderim varken ikinci dokunus in_progress alir; cokmus eski gonderim hakki yakmis sayilir", async () => {
    m.db.auditLog.findFirst.mockResolvedValue({ createdAt: new Date(NOW.getTime() - 10_000), metadata: { status: "sending" } });
    await expect(call()).resolves.toEqual({ ok: false, reason: "in_progress" });
    m.db.auditLog.findFirst.mockResolvedValue({ createdAt: new Date(NOW.getTime() - 30 * 60_000), metadata: { status: "sending" } });
    expect((await call()).ok).toBe(false);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("dogrulanmamis ya da anonim adrese gonderilmez", async () => {
    m.db.user.findUnique.mockResolvedValue({ ...USER, emailVerified: null });
    await expect(call()).resolves.toEqual({ ok: false, reason: "no_verified_email" });
    m.db.user.findUnique.mockResolvedValue({ ...USER, email: "gdpr_x@invalid.local" });
    const r = await call();
    expect(r.ok).toBe(false);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("gonderim duserse hak yanmaz: sahiplenme satiri failed eylemine doner", async () => {
    m.send.mockResolvedValue(false);
    await expect(call()).resolves.toEqual({ ok: false, reason: "mail_failed" });
    expect(m.db.auditLog.update).toHaveBeenCalledWith({
      where: { id: "claim1" },
      data: { action: "account.data_export_failed", metadata: { channel: "mobile", status: "failed" } },
    });
    // Disa aktarim kurulurken firlarsa da ayni yol.
    m.db.booking.findMany.mockRejectedValue(new Error("db"));
    m.send.mockClear();
    await expect(call()).resolves.toEqual({ ok: false, reason: "mail_failed" });
    expect(m.send).not.toHaveBeenCalled();
  });

  it("sahiplenme yazilamazsa hic gonderilmez (sinir sessizce kaybolmaz)", async () => {
    m.db.auditLog.create.mockRejectedValue(new Error("db down"));
    await expect(call()).rejects.toThrow("db down");
    expect(m.send).not.toHaveBeenCalled();
  });

  it("basaridan sonra durum guncellemesi duserse satir kalir, kullanici yine ok alir", async () => {
    m.db.auditLog.update.mockRejectedValue(new Error("db"));
    await expect(call()).resolves.toEqual({ ok: true, email: USER.email });
  });
});

describe("tasiyicilar", () => {
  const mobilePost = async (body?: unknown) =>
    (await mobileRoute.POST(
      new NextRequest("https://x/api/mobile/account/data-export", { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    ))!;

  it("mobil: her rol ister, dili servise iletir; goruntulemede 403", async () => {
    m.requireMobileUser.mockResolvedValue({ user: { id: USER.id, role: "ADMIN" } });
    const res = await mobilePost({ locale: "ru" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, email: USER.email });

    m.requireMobileUser.mockResolvedValue({ user: { id: USER.id, role: "GUEST", impersonatedBy: "a1" } });
    expect((await mobilePost()).status).toBe(403);
  });

  it("mobil: sinir 429 + retryAt, dogrulanmamis adres 409", async () => {
    m.requireMobileUser.mockResolvedValue({ user: { id: USER.id, role: "GUEST" } });
    m.db.auditLog.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 60 * 60_000), metadata: { status: "sent" } });
    const limited = await mobilePost();
    expect(limited.status).toBe(429);
    expect((await limited.json()).error).toBe("rate_limited");

    m.db.auditLog.findFirst.mockResolvedValue({ createdAt: new Date(), metadata: { status: "sending" } });
    const busy = await mobilePost();
    expect(busy.status).toBe(409);
    expect((await busy.json()).error).toBe("in_progress");

    m.db.user.findUnique.mockResolvedValue({ ...USER, emailVerified: null });
    expect((await mobilePost()).status).toBe(409);
  });

  it("web: oturumsuz 401; POST ayni servisle e-postalar, GET dosya indirir", async () => {
    m.auth.mockResolvedValue(null);
    expect((await webRoute.POST(new Request("https://x/api/account/data-export", { method: "POST" }))).status).toBe(401);

    m.auth.mockResolvedValue({ user: { id: USER.id, role: "PARTNER" } });
    const res = await webRoute.POST(
      new Request("https://x/api/account/data-export", { method: "POST", body: JSON.stringify({ locale: "fr" }) }),
    );
    expect(res.status).toBe(200);
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ locale: "fr" }));

    const dl = await webRoute.GET();
    expect(dl.status).toBe(200);
    expect(dl.headers.get("Content-Disposition")).toContain("bagajpark-data-u1234567.json");
    expect((await dl.json()).shops).toHaveLength(1);
  });
});

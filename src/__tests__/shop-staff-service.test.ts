import { describe, it, expect, vi, beforeEach } from "vitest";

const { db, mockRate, mockNotify, mockAudit } = vi.hoisted(() => {
  const db = {
    shop: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    shopMember: { findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    shopInvite: { count: vi.fn(), updateMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, mockRate: vi.fn(), mockNotify: vi.fn(), mockAudit: vi.fn() };
});
vi.mock("@/lib/db", () => ({ default: db }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRate }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: mockAudit }));
vi.mock("@/lib/site-base-url", () => ({ getSiteBaseUrl: () => "https://bagajpark.test" }));
vi.mock("@/services/NotificationService", () => ({ notificationService: { notifyShopStaffInvite: mockNotify } }));

import {
  MAX_STAFF_PER_SHOP,
  acceptInvite,
  hashInviteToken,
  inviteStaff,
  removeStaff,
} from "@/services/ShopStaffService";

const OWNER = { id: "owner", role: "PARTNER" };
const NOW = new Date("2026-11-24T10:00:00Z");
const SHOP = { id: "s1", name: "Otel", isActive: true, approvedAt: new Date(0), owner: { email: "sahip@example.com" } };

beforeEach(() => {
  vi.clearAllMocks();
  mockRate.mockResolvedValue(true);
  mockNotify.mockResolvedValue(undefined);
  db.shop.findUnique.mockResolvedValue(SHOP);
  db.user.findUnique.mockResolvedValue({ email: "sahip@example.com" });
  db.shopMember.findFirst.mockResolvedValue(null);
  db.shopMember.findUnique.mockResolvedValue(null);
  db.shopMember.count.mockResolvedValue(0);
  db.shopInvite.count.mockResolvedValue(0);
  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof db) => unknown)(db) : Promise.all(arg as unknown[]),
  );
});

describe("inviteStaff", () => {
  it("her zaman davet yolu: hesabi olan adres de dogrudan eklenmez", async () => {
    const res = await inviteStaff({ actor: OWNER, shopId: "s1", email: " Personel@Example.com ", locale: "en", now: NOW });
    expect(res).toEqual({ ok: true });
    expect(db.shopMember.create).not.toHaveBeenCalled();
    const data = db.shopInvite.create.mock.calls[0][0].data;
    expect(data.email).toBe("personel@example.com");
    expect(data.expiresAt.getTime() - NOW.getTime()).toBe(7 * 24 * 3600_000);
    const link: string = mockNotify.mock.calls[0][0].link;
    expect(link).toMatch(/^https:\/\/bagajpark\.test\/en\/staff-invite\?t=/);
    const token = decodeURIComponent(link.split("t=")[1]);
    expect(data.tokenHash).toBe(hashInviteToken(token));
    // Ayni adrese onceki gecerli davet iptal edilir; tavan ve yazim serilestirilebilir islemde.
    expect(db.shopInvite.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { revokedAt: NOW } }));
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("zaten ekipte olan adres: ayni yanit, bag gitmez (hesap var mi sorusu cevapsiz)", async () => {
    db.shopMember.findFirst.mockResolvedValueOnce({ id: "m" });
    expect(await inviteStaff({ actor: OWNER, shopId: "s1", email: "uye@example.com", locale: "tr" })).toEqual({ ok: true });
    expect(db.shopInvite.create).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("sinirlar: gecersiz e-posta, sahip, kendisi, onaysiz dukkan, tavan, hiz siniri", async () => {
    expect(await inviteStaff({ actor: OWNER, shopId: "s1", email: "x", locale: "tr" })).toEqual({ ok: false, code: "INVALID_EMAIL" });
    expect(await inviteStaff({ actor: OWNER, shopId: "s1", email: "sahip@example.com", locale: "tr" })).toEqual({ ok: false, code: "OWNER" });
    db.user.findUnique.mockResolvedValueOnce({ email: "ben@example.com" });
    expect(await inviteStaff({ actor: { id: "adm", role: "ADMIN" }, shopId: "s1", email: "ben@example.com", locale: "tr" })).toEqual({ ok: false, code: "SELF" });

    db.shop.findUnique.mockResolvedValueOnce({ ...SHOP, approvedAt: null });
    expect(await inviteStaff({ actor: OWNER, shopId: "s1", email: "a@example.com", locale: "tr" })).toEqual({ ok: false, code: "SHOP_INACTIVE" });
    db.shop.findUnique.mockResolvedValueOnce({ ...SHOP, isActive: false });
    expect(await inviteStaff({ actor: OWNER, shopId: "s1", email: "a@example.com", locale: "tr" })).toEqual({ ok: false, code: "SHOP_INACTIVE" });

    db.shopMember.count.mockResolvedValueOnce(MAX_STAFF_PER_SHOP - 1);
    db.shopInvite.count.mockResolvedValueOnce(1);
    expect(await inviteStaff({ actor: OWNER, shopId: "s1", email: "on@example.com", locale: "tr" })).toEqual({ ok: false, code: "LIMIT" });

    mockRate.mockResolvedValueOnce(false);
    expect(await inviteStaff({ actor: OWNER, shopId: "s1", email: "hiz@example.com", locale: "tr" })).toEqual({ ok: false, code: "RATE_LIMITED" });
    expect(db.shopInvite.create).not.toHaveBeenCalled();
  });

  it("es zamanli yazim cakismasi (P2034) temiz CONFLICT olur", async () => {
    db.$transaction.mockRejectedValueOnce(Object.assign(new Error("tx"), { code: "P2034" }));
    expect(await inviteStaff({ actor: OWNER, shopId: "s1", email: "a@example.com", locale: "tr" })).toEqual({ ok: false, code: "CONFLICT" });
  });

  it("yonetici yazimi denetim kaydina gider, esnafinki gitmez", async () => {
    await inviteStaff({ actor: OWNER, shopId: "s1", email: "a@example.com", locale: "tr" });
    expect(mockAudit).not.toHaveBeenCalled();
    await inviteStaff({ actor: { id: "adm", role: "ADMIN" }, shopId: "s1", email: "b@example.com", locale: "tr" });
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.shop_staff.invite", entityId: "s1" }));
  });
});

describe("acceptInvite", () => {
  const invite = {
    id: "i1",
    shopId: "s1",
    email: "yeni@example.com",
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date(NOW.getTime() + 3600_000),
    invitedById: "owner",
    shop: { name: "Otel", ownerId: "owner", isActive: true, approvedAt: new Date(0) },
  };
  const V = { emailVerified: true };

  beforeEach(() => {
    db.shopInvite.findUnique.mockResolvedValue(invite);
    db.shopInvite.updateMany.mockResolvedValue({ count: 1 });
  });

  it("davet edilen e-postanin hesabi kabul eder, uyelik acilir", async () => {
    const res = await acceptInvite("tok", { id: "u9", email: "Yeni@Example.com", ...V }, NOW);
    expect(res).toEqual({ ok: true, shopId: "s1", shopName: "Otel" });
    expect(db.shopInvite.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashInviteToken("tok") } }));
    expect(db.shopMember.create).toHaveBeenCalledWith({ data: { shopId: "s1", userId: "u9", invitedById: "owner" } });
  });

  it("dogrulanmamis e-postanin hesabi kabul edemez (on-hesap ele gecirme)", async () => {
    expect(await acceptInvite("tok", { id: "u9", email: invite.email, emailVerified: false }, NOW)).toEqual({
      ok: false,
      code: "EMAIL_UNVERIFIED",
    });
    expect(db.shopInvite.updateMany).not.toHaveBeenCalled();
  });

  it("zaten uye (P2002) temiz ALREADY_MEMBER; onaysiz dukkanda kabul yok", async () => {
    db.shopMember.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    expect(await acceptInvite("tok", { id: "u9", email: invite.email, ...V }, NOW)).toEqual({ ok: false, code: "ALREADY_MEMBER" });
    db.shopInvite.findUnique.mockResolvedValueOnce({ ...invite, shop: { ...invite.shop, isActive: false } });
    expect(await acceptInvite("tok", { id: "u9", email: invite.email, ...V }, NOW)).toEqual({ ok: false, code: "SHOP_INACTIVE" });
  });

  it("baska e-postanin hesabi kabul edemez (iletilen bag)", async () => {
    expect(await acceptInvite("tok", { id: "u9", email: "baska@example.com", ...V }, NOW)).toEqual({ ok: false, code: "EMAIL_MISMATCH" });
    expect(db.shopMember.create).not.toHaveBeenCalled();
  });

  it("suresi dolmus, kullanilmis ya da geri alinmis davet calismaz", async () => {
    db.shopInvite.findUnique.mockResolvedValueOnce({ ...invite, expiresAt: new Date(NOW.getTime() - 1) });
    expect(await acceptInvite("tok", { id: "u9", email: invite.email, ...V }, NOW)).toEqual({ ok: false, code: "EXPIRED" });
    db.shopInvite.findUnique.mockResolvedValueOnce({ ...invite, acceptedAt: NOW });
    expect(await acceptInvite("tok", { id: "u9", email: invite.email, ...V }, NOW)).toEqual({ ok: false, code: "INVALID" });
    db.shopInvite.findUnique.mockResolvedValueOnce({ ...invite, revokedAt: NOW });
    expect(await acceptInvite("tok", { id: "u9", email: invite.email, ...V }, NOW)).toEqual({ ok: false, code: "INVALID" });
  });

  it("es zamanli ikinci kabul tek kullanim kosulunda duser", async () => {
    db.shopInvite.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await acceptInvite("tok", { id: "u9", email: invite.email, ...V }, NOW)).toEqual({ ok: false, code: "INVALID" });
    expect(db.shopMember.create).not.toHaveBeenCalled();
  });
});

describe("removeStaff", () => {
  it("uyeligi siler; olmayan icin false", async () => {
    db.shopMember.deleteMany.mockResolvedValueOnce({ count: 1 });
    expect(await removeStaff(OWNER, "s1", "u2")).toBe(true);
    expect(db.shopMember.deleteMany).toHaveBeenCalledWith({ where: { shopId: "s1", userId: "u2" } });
    db.shopMember.deleteMany.mockResolvedValueOnce({ count: 0 });
    expect(await removeStaff(OWNER, "s1", "u3")).toBe(false);
  });
});

describe("davet e-postasinda dukkan adi", () => {
  it("duz metinde satir/etiket enjekte edilemez, uzunluk sinirli", async () => {
    const { plainShopName } = await vi.importActual<typeof import("@/services/NotificationService")>("@/services/NotificationService");
    expect(plainShopName("Otel\r\nBcc: x@example.com <b>")).toBe("Otel Bcc: x@example.com b");
    expect(plainShopName("x".repeat(200))).toHaveLength(80);
  });
});

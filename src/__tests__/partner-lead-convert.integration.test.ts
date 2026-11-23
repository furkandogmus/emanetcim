/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.unmock("@/lib/db");
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyAdminsForPartnerLead: vi.fn(async () => undefined),
    sendMobilePush: vi.fn(async () => undefined),
    sendSms: vi.fn(async () => undefined),
  },
}));
vi.mock("@/lib/site-urls", () => ({ getSiteBaseUrl: () => "https://example.test" }));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn(async () => undefined), sendEmail: vi.fn(async () => undefined) }));

/**
 * On kaydi esnafa cevirme gercek Postgres'te: tek transaction, kosullu
 * isaretleme ile idempotentlik, es zamanli cagri, tekillik hatalari, misafir
 * hesabinin devri ve "simdi ac" ile slot uretimi.
 * CI'da (`CI=true` + `DATABASE_URL`) ya da `RUN_DB_TESTS=1` ile kosar.
 */
const run =
  Boolean(process.env.DATABASE_URL) && (process.env.CI === "true" || process.env.RUN_DB_TESTS === "1");

describe.skipIf(!run)("on kaydi esnafa cevirme (gercek DB)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let svc: any;
  const suf = `${Date.now()}`.slice(-7);
  // Her test kendi numarasini alir: 55x + son yedi hane, tekil kisitlar cakismasin.
  const gsm = (n: number) => `55${n}${suf}`;
  const userIds: string[] = [];
  const leadIds: string[] = [];
  let adminId = "";
  const LOC = "41.0151, 28.9795";

  const lead = async (phone: string, over: Record<string, unknown> = {}) => {
    const l = await prisma.partnerLead.create({
      data: { fullName: "Deneme Esnaf", phone, shopName: "Deneme Emanet", address: "Ornek Mah. Test Sok. No 1", ...over },
    });
    leadIds.push(l.id);
    return l.id as string;
  };
  const convert = (leadId: string, over: Record<string, unknown> = {}) =>
    svc.convertToPartner({ leadId, location: LOC, actor: { userId: adminId, ip: "198.51.100.7" }, ...over });

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).default;
    ({ partnerLeadService: svc } = await import("@/services/PartnerLeadService"));
    const admin = await prisma.user.create({ data: { role: "ADMIN", email: `admin-${suf}@test.local` } });
    adminId = admin.id;
    userIds.push(admin.id);
  });

  afterAll(async () => {
    if (!prisma) return;
    const converted = await prisma.partnerLead.findMany({ where: { id: { in: leadIds } } });
    const owners = converted.map((l: { convertedUserId: string | null }) => l.convertedUserId).filter(Boolean);
    await prisma.partnerLead.deleteMany({ where: { id: { in: leadIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: adminId } });
    await prisma.user.deleteMany({ where: { id: { in: [...owners, ...userIds] } } });
    await prisma.$disconnect();
  });

  it("on kayittan esnaf + onaysiz dukkan acar, kaydi isaretler, denetim yazar", async () => {
    const id = await lead(gsm(1));
    const r = await convert(id, { city: "Istanbul", district: "Fatih" });
    expect(r).toMatchObject({ ok: true, alreadyConverted: false, activated: false, phone: gsm(1) });
    expect(r.resetUrl).toMatch(/reset|sifre|password/i);

    const user = await prisma.user.findUnique({ where: { id: r.userId } });
    expect(user).toMatchObject({ role: "PARTNER", name: "Deneme Esnaf", phone: gsm(1), passwordHash: null });
    const shop = await prisma.shop.findUnique({ where: { id: r.shopId } });
    expect(shop).toMatchObject({
      ownerId: r.userId, name: "Deneme Emanet", isActive: false, city: "Istanbul", latitude: 41.0151,
    });
    expect(await prisma.shopTimeSlot.count({ where: { shopId: r.shopId } })).toBe(0);

    const l = await prisma.partnerLead.findUnique({ where: { id } });
    expect(l).toMatchObject({ status: "CONVERTED", convertedById: adminId, convertedUserId: r.userId, convertedShopId: r.shopId });
    expect(l.convertedAt).toBeInstanceOf(Date);
    expect(await prisma.auditLog.count({ where: { action: "partner.lead_converted", entityId: id } })).toBe(1);
  });

  it("idempotent: ikinci ve es zamanli cagri yeni hesap acmaz", async () => {
    const id = await lead(gsm(2));
    const [a, b] = await Promise.all([convert(id), convert(id)]);
    expect([a.ok, b.ok]).toEqual([true, true]);
    expect(new Set([a.shopId, b.shopId]).size).toBe(1);
    expect([a.alreadyConverted, b.alreadyConverted].sort()).toEqual([false, true]);
    const again = await convert(id);
    expect(again).toMatchObject({ ok: true, alreadyConverted: true, shopId: a.shopId, resetUrl: null });
    expect(await prisma.shop.count({ where: { owner: { phone: gsm(2) } } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "partner.lead_converted", entityId: id } })).toBe(1);
  });

  it("esnaf hesabindaki telefon ve e-posta acik hata, on kayit isaretlenmez", async () => {
    const partner = await prisma.user.create({
      data: { role: "PARTNER", phone: gsm(3), email: `p-${suf}@test.local` },
    });
    userIds.push(partner.id);
    const id = await lead(gsm(3));
    expect(await convert(id)).toEqual({ ok: false, reason: "phone_already_registered" });
    expect(await convert(id, { phone: gsm(4), email: `p-${suf}@test.local` })).toEqual({
      ok: false,
      reason: "email_already_registered",
    });
    expect((await prisma.partnerLead.findUnique({ where: { id } })).convertedAt).toBeNull();
  });

  it("e-posta bir misafire aitse o hesap esnafa cevrilir", async () => {
    const guest = await prisma.user.create({
      data: { role: "GUEST", email: `g-${suf}@test.local`, passwordHash: "x" },
    });
    userIds.push(guest.id);
    const id = await lead(gsm(5));
    const r = await convert(id, { email: `G-${suf}@test.local` });
    expect(r).toMatchObject({ ok: true, userId: guest.id, resetUrl: null });
    expect(await prisma.user.findUnique({ where: { id: guest.id } })).toMatchObject({ role: "PARTNER", phone: gsm(5) });
  });

  it("gecersiz girdi ve konumsuz cevirme reddedilir", async () => {
    const id = await lead("2125550000");
    expect(await convert(id)).toEqual({ ok: false, reason: "invalid_tr_phone" });
    expect(await convert(id, { phone: gsm(6), location: "" })).toEqual({ ok: false, reason: "location_required" });
    expect(await convert(id, { phone: gsm(6), shopName: "x" })).toEqual({ ok: false, reason: "invalid_data" });
    expect(await convert("yok-boyle-bir-kayit")).toEqual({ ok: false, reason: "not_found" });
  });

  it("'simdi ac' dukkani onaydan gecirir ve slotlarini uretir", async () => {
    const id = await lead(gsm(7));
    const r = await convert(id, { activate: true });
    expect(r).toMatchObject({ ok: true, activated: true });
    expect(await prisma.shop.findUnique({ where: { id: r.shopId } })).toMatchObject({ isActive: true });
    // Slot uretimi ates-unut: onaydan sonra arka planda tamamlanir.
    await vi.waitFor(async () => expect(await prisma.shopTimeSlot.count({ where: { shopId: r.shopId } })).toBeGreaterThan(0), {
      timeout: 10_000,
      interval: 200,
    });
  });
});

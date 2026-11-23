/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.unmock("@/lib/db");

/**
 * Dukkan basina slot uretimi gercek Postgres'te (2026-11-23 olayi): tekil kisit,
 * danisma kilidi ve rezervasyonlu slotun korunmasi ancak gercek DB'de olculur.
 * CI'da (`CI=true` + `DATABASE_URL`) ya da `RUN_DB_TESTS=1` ile kosar.
 */
const run =
  Boolean(process.env.DATABASE_URL) && (process.env.CI === "true" || process.env.RUN_DB_TESTS === "1");

describe.skipIf(!run)("dukkan basina slot uretimi (gercek DB)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let generateSlotsForShop: any;
  const suf = `slots-${Date.now()}`;
  let ownerId = "";
  let shopA = "";
  let shopB = "";
  // Yarin Istanbul 00:00 sonrasi: gunun tum saatleri gelecekte.
  const now = new Date();

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).default;
    ({ generateSlotsForShop } = await import("@/services/SlotService"));
    const owner = await prisma.user.create({
      data: { role: "PARTNER", name: "Test Esnaf", email: `${suf}@test.local` },
    });
    ownerId = owner.id;
    const mk = (name: string) =>
      prisma.shop.create({
        data: {
          ownerId,
          name,
          latitude: 41.0,
          longitude: 29.0,
          isActive: true,
          approvedAt: new Date(),
          openingTime: "09:00",
          closingTime: "20:00",
          capacity: 8,
        },
      });
    shopA = (await mk(`A ${suf}`)).id;
    shopB = (await mk(`B ${suf}`)).id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.booking.deleteMany({ where: { shopId: { in: [shopA, shopB] } } });
    await prisma.shop.deleteMany({ where: { id: { in: [shopA, shopB] } } });
    await prisma.user.deleteMany({ where: { id: ownerId } });
    await prisma.$disconnect();
  });

  const count = (shopId: string, extra: Record<string, unknown> = {}) =>
    prisma.shopTimeSlot.count({ where: { shopId, ...extra } });

  it("yalnizca o dukkana slot yazar", async () => {
    const r = await generateSlotsForShop(shopA, { horizonDays: 3, now });
    expect(r.created).toBeGreaterThan(0);
    expect(await count(shopA)).toBe(r.created);
    expect(await count(shopB)).toBe(0);
  });

  it("idempotent: tekrar ve ES ZAMANLI cagri cift slot uretmez", async () => {
    const before = await count(shopA);
    const results = await Promise.all([
      generateSlotsForShop(shopA, { horizonDays: 3, now }),
      generateSlotsForShop(shopA, { horizonDays: 3, now }),
      generateSlotsForShop(shopA, { horizonDays: 3, now, mode: "fill" }),
    ]);
    expect(results.map((x: { created: number }) => x.created)).toEqual([0, 0, 0]);
    expect(await count(shopA)).toBe(before);
  });

  it("saat daralinca rezervasyonsuz gelecek slot pasife alinir, rezervasyonlu korunur", async () => {
    const last = await prisma.shopTimeSlot.findFirst({
      where: { shopId: shopA, isActive: true },
      orderBy: { startTime: "desc" },
    });
    // 19:30 slotunun bir rezervasyonu var; esnaf kapanisi 18:00'e cekiyor.
    const booking = await prisma.booking.create({
      data: {
        shopId: shopA,
        guestEmail: `g-${suf}@test.local`,
        status: "APPROVED",
        checkInTime: last.startTime,
        checkOutTime: last.endTime,
        bagCountS: 1,
      },
    });
    await prisma.reservationSlot.create({ data: { bookingId: booking.id, slotId: last.id, bagCount: 1 } });

    await prisma.shop.update({ where: { id: shopA }, data: { closingTime: "18:00", capacity: 12 } });
    const r = await generateSlotsForShop(shopA, { horizonDays: 3, now });
    expect(r.created).toBe(0);
    expect(r.deactivated).toBeGreaterThan(0);

    const kept = await prisma.shopTimeSlot.findUnique({ where: { id: last.id } });
    expect(kept).toMatchObject({ isActive: true, capacity: 8 });
    expect(await prisma.reservationSlot.count({ where: { slotId: last.id } })).toBe(1);
    // Kalan acik slotlar yeni kapasitede; rezervasyonlu slot eski kapasitesinde.
    expect(await count(shopA, { isActive: true, capacity: 12 })).toBe(
      (await count(shopA, { isActive: true })) - 1,
    );

    // Saat geri genisleyince pasif slotlar yeniden acilir, yeni satir yazilmaz.
    await prisma.shop.update({ where: { id: shopA }, data: { closingTime: "20:00" } });
    const back = await generateSlotsForShop(shopA, { horizonDays: 3, now });
    expect(back.created).toBe(0);
    expect(back.reactivated).toBe(r.deactivated);
  });

  it("pasif dukkana slot yazilmaz", async () => {
    await prisma.shop.update({ where: { id: shopB }, data: { isActive: false } });
    const r = await generateSlotsForShop(shopB, { horizonDays: 3, now });
    expect(r.skipped).toBe("not_operating");
    expect(await count(shopB)).toBe(0);
  });
});

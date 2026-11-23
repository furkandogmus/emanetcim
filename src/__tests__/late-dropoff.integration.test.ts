/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.unmock("@/lib/db");
// Bildirim yok: yalnizca kosullu yazimlarin gercek Postgres'teki davranisi olculur.
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    sendLateDropoffNotice: vi.fn(async () => ({ push: false, email: false })),
    notifyPartnerLateDropoff: vi.fn(async () => false),
    notifyCheckIn: vi.fn(async () => undefined),
    pushGuestOnly: vi.fn(),
    notifyPartnerBookingChange: vi.fn(async () => undefined),
    notifyGuestBookingClosed: vi.fn(async () => undefined),
  },
}));

/**
 * Otomatik kapanisin KOSULLU kilidi gercek Postgres'te: tarama ile kilit arasinda
 * check-in ya da "Misafiri bekle" gelirse rezervasyon iptal edilmez. Tum DB'yi
 * tarayan `run()` burada CAGRILMAZ (paylasilan test DB'sindeki baska kayitlari
 * kapatirdi); taramanin kilide gecirdigi `lateCloseGuard` dogrudan kullanilir.
 * CI'da (`CI=true` + `DATABASE_URL`) ya da `RUN_DB_TESTS=1` ile kosar.
 */
const run =
  Boolean(process.env.DATABASE_URL) && (process.env.CI === "true" || process.env.RUN_DB_TESTS === "1");

describe.skipIf(!run)("gec birakma kapanisi (gercek DB)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cancelBooking: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lateCloseGuard: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let holdLateBooking: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let checkIn: any;
  const suf = `late-${Date.now()}`;
  const bookingIds: string[] = [];
  let shopId = "";
  let ownerId = "";
  const now = new Date();
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);

  const late = async (data: Record<string, unknown> = {}) => {
    const b = await prisma.booking.create({
      data: {
        shopId,
        guestEmail: `g-${suf}@test.local`,
        status: "APPROVED",
        checkInTime: ago(65),
        checkOutTime: new Date(now.getTime() + 3 * 3600_000),
        bagCountS: 1,
        ...data,
      },
    });
    bookingIds.push(b.id);
    return b.id as string;
  };
  const close = (id: string) =>
    cancelBooking(id, { silent: true, reason: "no_show", guard: lateCloseGuard(now), eventMetadata: { auto: true } });

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).default;
    ({ cancelBooking } = await import("@/services/booking/lifecycle"));
    ({ lateCloseGuard } = await import("@/services/LateDropoffService"));
    ({ holdLateBooking } = await import("@/services/booking/late-hold"));
    ({ checkIn } = await import("@/services/booking/check-in"));
    ownerId = (await prisma.user.create({ data: { email: `o-${suf}@test.local`, role: "PARTNER" } })).id;
    shopId = (await prisma.shop.create({ data: { ownerId, name: "Ornek", open247: true, isActive: true } })).id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.bookingEvent.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.paymentLog.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.shop.deleteMany({ where: { id: shopId } });
    await prisma.user.deleteMany({ where: { id: ownerId } });
  });

  it("vadesi gelmis kayit no_show + auto ile kapanir", async () => {
    const id = await late();
    expect((await close(id)).ok).toBe(true);
    expect((await prisma.booking.findUnique({ where: { id } })).status).toBe("CANCELLED");
    const ev = await prisma.bookingEvent.findFirst({ where: { bookingId: id, event: "CANCELLED" } });
    expect(ev.metadata).toMatchObject({ reason: "no_show", auto: true });
  });

  it("taramadan sonra yazilan bekletme kilidi bozar: iptal olmaz", async () => {
    const id = await late();
    // Tarama kaydi secti; kilitten once esnaf "Misafiri bekle"ye basti.
    const held = await holdLateBooking(id, { id: ownerId, role: "PARTNER" }, now);
    expect(held.ok).toBe(true);
    expect(await close(id)).toMatchObject({ ok: false, code: "INVALID_STATUS" });
    expect((await prisma.booking.findUnique({ where: { id } })).status).toBe("APPROVED");
  });

  it("checkedInAt dolu kayit durum alanindan bagimsiz kapanmaz", async () => {
    const id = await late({ checkedInAt: ago(1) });
    expect(await close(id)).toMatchObject({ ok: false, code: "INVALID_STATUS" });
    expect((await prisma.booking.findUnique({ where: { id } })).status).toBe("APPROVED");
  });

  it("check-in ile otomatik kapanis yarisi: biri kazanir, CANCELLED + checkedInAt asla olmaz", async () => {
    for (let i = 0; i < 5; i++) {
      const id = await late();
      const [ci, cl] = await Promise.all([checkIn(id), close(id)]);
      const row = await prisma.booking.findUnique({ where: { id } });
      expect([ci.ok, cl.ok].filter(Boolean)).toHaveLength(1);
      if (row.status === "CANCELLED") expect(row.checkedInAt).toBeNull();
      else expect(row).toMatchObject({ status: "CHECKED_IN" });
    }
  });

  it("es zamanli iki 'Misafiri bekle' kapanisi yalnizca bir kez uzatir", async () => {
    const id = await late({ checkInTime: ago(45) });
    const actor = { id: ownerId, role: "PARTNER" };
    const rs = await Promise.all([holdLateBooking(id, actor, now), holdLateBooking(id, actor, now)]);
    expect(rs.filter((r: { ok: boolean }) => r.ok)).toHaveLength(1);
    const row = await prisma.booking.findUnique({ where: { id } });
    // checkIn -45 dk: kapanis +15 dk; tek uzatma +45 dk.
    expect(row.lateHoldUntil.getTime()).toBe(now.getTime() + 45 * 60_000);
  });
});

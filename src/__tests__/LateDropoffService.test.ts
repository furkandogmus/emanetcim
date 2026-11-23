import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Gec birakma taramasi (`LateDropoffService`). Bellek ici sahte veritabani: tarama
 * sorgusu ve kilit icindeki yeniden okuma ayni kayitlari gorur; `cancelBooking`
 * sahte, ona gecen `guard` ve bildirim kararlari olculur. Kosullu kilidin gercek
 * Postgres'teki davranisi `late-dropoff.integration.test.ts`te.
 */
const h = vi.hoisted(() => {
  type Booking = {
    id: string;
    status: string;
    checkInTime: Date;
    checkOutTime: Date;
    checkedInAt: Date | null;
    lateHoldUntil: Date | null;
    guestId: string | null;
    guestEmail: string | null;
    locale: string | null;
    guest: { email: string | null } | null;
    shop: { name: string; timezone: string; owner: { phone: string | null } };
  };
  type Event = { bookingId: string; event: string; metadata: Record<string, unknown> };
  const db = { bookings: [] as Booking[], events: [] as Event[] };

  type Range = { gt?: Date; gte?: Date; lt?: Date; lte?: Date };
  const inRange = (d: Date, r: Range) =>
    (!r.gt || d > r.gt) && (!r.gte || d >= r.gte) && (!r.lt || d < r.lt) && (!r.lte || d <= r.lte);
  // Taramanin kullandigi kosullar: durum, checkedInAt null, checkInTime araligi, bekletme OR'u, notIn.
  const match = (b: Booking, w: Record<string, unknown>): boolean => {
    const st = w.status as { in: string[] } | undefined;
    if (st && !st.in.includes(b.status)) return false;
    if ("checkedInAt" in w && w.checkedInAt === null && b.checkedInAt !== null) return false;
    if (w.checkInTime && !inRange(b.checkInTime, w.checkInTime as Range)) return false;
    const id = w.id as { notIn: string[] } | undefined;
    if (id?.notIn.includes(b.id)) return false;
    const or = w.OR as Array<{ lateHoldUntil: null | { lte: Date } }> | undefined;
    if (or) {
      const ok = or.some((c) =>
        c.lateHoldUntil === null ? b.lateHoldUntil === null : !!b.lateHoldUntil && b.lateHoldUntil <= c.lateHoldUntil.lte,
      );
      if (!ok) return false;
    }
    return true;
  };

  const prisma = {
    booking: {
      findMany: vi.fn(async ({ where, take }: { where: Record<string, unknown>; take: number }) =>
        db.bookings
          .filter((b) => match(b, where))
          .sort((a, c) => a.checkInTime.getTime() - c.checkInTime.getTime())
          .slice(0, take)
          .map((b) => ({ ...b })),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const b = db.bookings.find((x) => x.id === where.id);
        return b ? { ...b } : null;
      }),
    },
    bookingEvent: {
      findMany: vi.fn(async ({ where }: { where: { bookingId: string | { in: string[] }; event: string } }) =>
        db.events.filter(
          (e) =>
            e.event === where.event &&
            (typeof where.bookingId === "string" ? e.bookingId === where.bookingId : where.bookingId.in.includes(e.bookingId)),
        ),
      ),
      create: vi.fn(async ({ data }: { data: Event }) => {
        db.events.push(data);
        return data;
      }),
    },
    $executeRaw: vi.fn(async () => 0),
    $transaction: vi.fn(async (f: (tx: unknown) => unknown) => f(prisma)),
  };

  return {
    db,
    prisma,
    cancelBooking: vi.fn(),
    notify: { sendLateDropoffNotice: vi.fn(), notifyPartnerLateDropoff: vi.fn() },
  };
});

vi.mock("@/lib/db", () => ({ default: h.prisma }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/services/booking/lifecycle", () => ({ cancelBooking: h.cancelBooking }));
vi.mock("@/services/NotificationService", () => ({ notificationService: h.notify }));

import { LateDropoffService, LATE_DROPOFF_REMINDER_EVENT } from "@/services/LateDropoffService";

const CHECK_IN = new Date("2030-05-01T10:00:00Z");
const at = (m: number) => new Date(CHECK_IN.getTime() + m * 60_000);

function booking(over: Partial<(typeof h.db.bookings)[number]> = {}) {
  return {
    id: "b1",
    status: "PAID",
    checkInTime: CHECK_IN,
    checkOutTime: at(240),
    checkedInAt: null,
    lateHoldUntil: null,
    guestId: "g1",
    guestEmail: null,
    locale: "en",
    guest: { email: "misafir@ornek.com" },
    shop: { name: "Ornek Dukkan", timezone: "Europe/Istanbul", owner: { phone: "+90 555 000 0000" } },
    ...over,
  };
}

const svc = new LateDropoffService();
const reminderStages = () =>
  h.db.events.filter((e) => e.event === LATE_DROPOFF_REMINDER_EVENT).map((e) => e.metadata.stage);

beforeEach(() => {
  vi.clearAllMocks();
  h.db.bookings = [];
  h.db.events = [];
  h.notify.sendLateDropoffNotice.mockResolvedValue({ push: true, email: false });
  h.notify.notifyPartnerLateDropoff.mockResolvedValue(true);
  h.cancelBooking.mockResolvedValue({ ok: true, fullRefund: false });
});

describe("hatirlatmalar", () => {
  it("+15'te 1. asama gider; 5 dk sonraki calisma tekrar gondermez", async () => {
    h.db.bookings = [booking()];
    const r1 = await svc.run({ now: at(16) });
    expect(r1.remindersSent).toBe(1);
    expect(h.notify.sendLateDropoffNotice).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "b1", kind: "reminder", at: at(60), locale: "en" }),
    );
    expect(h.notify.notifyPartnerLateDropoff).not.toHaveBeenCalled();

    const r2 = await svc.run({ now: at(21) });
    expect(r2.remindersSent).toBe(0);
    expect(h.notify.sendLateDropoffNotice).toHaveBeenCalledTimes(1);
    expect(reminderStages()).toEqual([1]);
  });

  it("uc asama 5 dk'lik taramayla tam bir kez gider; +45'te esnafa da", async () => {
    h.db.bookings = [booking()];
    for (let m = 0; m < 60; m += 5) await svc.run({ now: at(m + 1) });
    expect(reminderStages()).toEqual([1, 2, 3]);
    expect(h.notify.sendLateDropoffNotice).toHaveBeenCalledTimes(3);
    expect(h.notify.notifyPartnerLateDropoff).toHaveBeenCalledTimes(1);
    expect(h.notify.notifyPartnerLateDropoff).toHaveBeenCalledWith({ bookingId: "b1", closeAt: at(60) });
  });

  it("yetisme yagmuru yok: +50'de ilk calisma yalnizca 3. asamayi gonderir", async () => {
    h.db.bookings = [booking()];
    await svc.run({ now: at(50) });
    expect(reminderStages()).toEqual([3]);
    expect(h.notify.sendLateDropoffNotice).toHaveBeenCalledTimes(1);
  });

  it("bekletme surerken misafire de esnafa da hatirlatma yok", async () => {
    h.db.bookings = [booking({ lateHoldUntil: at(90) })];
    await svc.run({ now: at(46) });
    expect(h.notify.sendLateDropoffNotice).not.toHaveBeenCalled();
    expect(h.notify.notifyPartnerLateDropoff).not.toHaveBeenCalled();
  });

  it("valizi birakilmis ve odemesiz (PENDING) kayda hatirlatma yok", async () => {
    h.db.bookings = [booking({ id: "a", checkedInAt: at(5) }), booking({ id: "p", status: "PENDING" })];
    await svc.run({ now: at(20) });
    expect(h.notify.sendLateDropoffNotice).not.toHaveBeenCalled();
  });

  it("ulasilacak kanal yoksa asama sahiplenilmez (+45'te esnaf yine uyarilir)", async () => {
    h.db.bookings = [booking({ guestId: null, guest: null, guestEmail: null })];
    const r = await svc.run({ now: at(20) });
    expect(r.noChannel).toBe(1);
    expect(reminderStages()).toEqual([]);
    await svc.run({ now: at(46) });
    expect(h.notify.notifyPartnerLateDropoff).toHaveBeenCalledTimes(1);
    expect(h.notify.sendLateDropoffNotice).not.toHaveBeenCalled();
  });

  it("birakma saati degistiyse eski saatin asamalari sayilmaz", async () => {
    h.db.bookings = [booking()];
    h.db.events = [
      { bookingId: "b1", event: LATE_DROPOFF_REMINDER_EVENT, metadata: { stage: 3, checkInTime: at(-120).toISOString() } },
    ];
    await svc.run({ now: at(16) });
    expect(h.notify.sendLateDropoffNotice).toHaveBeenCalledTimes(1);
  });

  it("kilit icinde valiz birakildiysa gonderilmez (lostRace)", async () => {
    h.db.bookings = [booking()];
    h.prisma.booking.findUnique.mockImplementationOnce(async () => ({ ...booking(), status: "CHECKED_IN", checkedInAt: at(15) }));
    const r = await svc.run({ now: at(16) });
    expect(r.lostRace).toBe(1);
    expect(h.notify.sendLateDropoffNotice).not.toHaveBeenCalled();
  });
});

describe("otomatik kapanis", () => {
  it("+60'ta no_show + auto ile, check-in/bekletme kosulu kilide gecerek kapanir; misafire 'kapandi' gider", async () => {
    h.db.bookings = [booking()];
    const r = await svc.run({ now: at(61) });
    expect(r.closed).toBe(1);
    const [id, opts] = h.cancelBooking.mock.calls[0];
    expect(id).toBe("b1");
    expect(opts).toMatchObject({ silent: true, reason: "no_show", eventMetadata: { auto: true } });
    expect(opts.guard).toEqual({
      checkedInAt: null,
      checkInTime: { lte: at(1) },
      OR: [{ lateHoldUntil: null }, { lateHoldUntil: { lte: at(61) } }],
    });
    expect(h.notify.sendLateDropoffNotice).toHaveBeenCalledWith(expect.objectContaining({ kind: "closed", at: at(60) }));
  });

  it("+60'tan once kapanmaz", async () => {
    h.db.bookings = [booking()];
    await svc.run({ now: at(59) });
    expect(h.cancelBooking).not.toHaveBeenCalled();
  });

  it("bekletme suruyorsa kapanmaz; bekletme bitince kapanir", async () => {
    h.db.bookings = [booking({ lateHoldUntil: at(90) })];
    await svc.run({ now: at(75) });
    expect(h.cancelBooking).not.toHaveBeenCalled();
    await svc.run({ now: at(91) });
    expect(h.cancelBooking).toHaveBeenCalledTimes(1);
    expect(h.notify.sendLateDropoffNotice).toHaveBeenCalledWith(expect.objectContaining({ kind: "closed", at: at(90) }));
  });

  it("valizi birakilmis rezervasyon ASLA kapanmaz", async () => {
    h.db.bookings = [booking({ checkedInAt: at(30) }), booking({ id: "c", status: "CHECKED_IN", checkedInAt: at(30) })];
    await svc.run({ now: at(600) });
    expect(h.cancelBooking).not.toHaveBeenCalled();
  });

  it("eski birikim (kapanisi > 2 sa once) SESSIZ kapanir: hatirlatma da 'kapandi' da yok", async () => {
    h.db.bookings = [booking({ id: "old", checkInTime: at(-24 * 60), checkOutTime: at(-20 * 60) })];
    const r = await svc.run({ now: at(0) });
    expect(r).toMatchObject({ closed: 1, closedSilently: 1 });
    expect(h.cancelBooking.mock.calls[0][1].eventMetadata).toEqual({ auto: true, notified: false });
    expect(h.notify.sendLateDropoffNotice).not.toHaveBeenCalled();
    expect(h.notify.notifyPartnerLateDropoff).not.toHaveBeenCalled();
  });

  it("odemesiz niyet (PENDING) bildirimsiz kapanir", async () => {
    h.db.bookings = [booking({ status: "PENDING" })];
    const r = await svc.run({ now: at(61) });
    expect(r.closedSilently).toBe(1);
    expect(h.notify.sendLateDropoffNotice).not.toHaveBeenCalled();
  });

  it("kosullu kilit eslesmezse (arada check-in) bildirim gitmez, sayilir", async () => {
    h.db.bookings = [booking()];
    h.cancelBooking.mockResolvedValue({ ok: false, code: "INVALID_STATUS", message: "x" });
    const r = await svc.run({ now: at(61) });
    expect(r).toMatchObject({ closed: 0, closeSkipped: 1 });
    expect(h.notify.sendLateDropoffNotice).not.toHaveBeenCalled();
  });

  it("toplu calisir ve ayni kosuda denenmis kaydi bir daha secmez", async () => {
    h.db.bookings = ["a", "b", "c"].map((id) => booking({ id }));
    h.cancelBooking.mockResolvedValue({ ok: false, code: "INVALID_STATUS", message: "x" });
    const r = await svc.run({ now: at(61), batchSize: 2 });
    expect(r.closeScanned).toBe(3);
    expect(h.cancelBooking).toHaveBeenCalledTimes(3);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Bellek ici sahte veritabani. `pg_advisory_xact_lock` gercek bir anahtar kilidiyle
 * taklit ediliyor ve her cagri bir mikro-gorev bekliyor: iki es zamanli calisma
 * gercekten ic ice girer, yani kilit ya da kilit icindeki yeniden okuma kaldirilirsa
 * es zamanlilik testi kirmizi olur.
 */
const h = vi.hoisted(() => {
  type Booking = {
    id: string;
    status: string;
    checkOutTime: Date;
    guestId: string | null;
    guestEmail: string | null;
    locale: string | null;
    guest: { email: string | null } | null;
    shop: {
      name: string;
      address: string | null;
      openingTime: string | null;
      closingTime: string | null;
      open247: boolean;
      timezone: string;
    };
  };
  type Event = { bookingId: string; event: string; metadata: Record<string, unknown> };
  const db = { bookings: [] as Booking[], events: [] as Event[] };
  /** Taramadan SONRA, kilit icinde okunan durum (arada teslim/iptal benzetimi). */
  const statusInsideLock = new Map<string, string>();
  const tick = () => new Promise<void>((r) => setTimeout(r, 0));
  const locks = new Map<string, Promise<void>>();

  type Where = {
    status?: string;
    checkOutTime?: { gte?: Date; lte: Date };
    bookingId?: string | { in: string[] };
    event?: string;
  };
  const matchEvent = (e: Event, w: Where) =>
    (typeof w.bookingId === "string" ? e.bookingId === w.bookingId : w.bookingId!.in.includes(e.bookingId)) &&
    e.event === w.event;

  const bookingEventApi = {
    findMany: vi.fn(async ({ where }: { where: Where }) => {
      await tick();
      return db.events.filter((e) => matchEvent(e, where)).map((e) => ({ ...e }));
    }),
    create: vi.fn(async ({ data }: { data: Event }) => {
      await tick();
      db.events.push(data);
      return data;
    }),
  };

  const prisma = {
    booking: {
      findMany: vi.fn(async ({ where, take }: { where: Where; take: number }) => {
        await tick();
        return db.bookings
          .filter(
            (b) =>
              b.status === where.status &&
              b.checkOutTime <= where.checkOutTime!.lte &&
              (!where.checkOutTime!.gte || b.checkOutTime >= where.checkOutTime!.gte),
          )
          .sort((a, b) => a.checkOutTime.getTime() - b.checkOutTime.getTime())
          .slice(0, take);
      }),
    },
    bookingEvent: bookingEventApi,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      let release: () => void = () => {};
      let lockedKey: string | null = null;
      const tx = {
        $executeRaw: vi.fn(async (_s: TemplateStringsArray, key: string) => {
          while (locks.has(key)) await locks.get(key);
          lockedKey = key;
          locks.set(key, new Promise<void>((r) => (release = r)));
          return 1;
        }),
        booking: {
          findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
            await tick();
            const b = db.bookings.find((x) => x.id === where.id);
            return b ? { status: statusInsideLock.get(b.id) ?? b.status } : null;
          }),
        },
        bookingEvent: bookingEventApi,
      };
      try {
        return await fn(tx);
      } finally {
        if (lockedKey) locks.delete(lockedKey);
        release();
      }
    }),
  };
  const send = vi.fn(async (_p: unknown): Promise<{ push: boolean; email: boolean }> => {
    await tick();
    return { push: true, email: true };
  });
  return { db, prisma, send, statusInsideLock };
});

vi.mock("@/lib/db", () => ({ default: h.prisma }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: { sendOverdueGuestReminder: h.send },
}));

import { OverdueGuestReminderService } from "@/services/OverdueGuestReminderService";

const CHECKOUT = new Date("2026-11-20T10:00:00.000Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const at = (ms: number) => new Date(CHECKOUT.getTime() + ms);

function addBooking(over: Partial<(typeof h.db.bookings)[number]> = {}) {
  h.db.bookings.push({
    id: "b1",
    status: "CHECKED_IN",
    checkOutTime: CHECKOUT,
    guestId: "u1",
    guestEmail: null,
    locale: "en",
    guest: { email: "guest@example.com" },
    shop: {
      name: "Kadikoy Bufe",
      address: "Moda Cd. 1",
      openingTime: "09:00",
      closingTime: "20:00",
      open247: false,
      timezone: "Europe/Istanbul",
    },
    ...over,
  });
}

type SendArgs = { bookingId: string; email: string | null; hasAccount: boolean; locale: string };
const sentArgs = () => h.send.mock.calls.map((c) => c[0] as SendArgs);

describe("OverdueGuestReminderService", () => {
  const service = new OverdueGuestReminderService();

  beforeEach(() => {
    vi.clearAllMocks();
    h.db.bookings.length = 0;
    h.db.events.length = 0;
    h.statusInsideLock.clear();
  });

  it("29. dakikada gondermez, 31. dakikada birinci slotu gonderir ve kaydeder", async () => {
    addBooking();
    await service.run({ now: at(29 * MIN) });
    expect(h.send).not.toHaveBeenCalled();

    const r = await service.run({ now: at(31 * MIN) });
    expect(r.sent).toBe(1);
    expect(h.db.events).toEqual([
      { bookingId: "b1", event: "OVERDUE_GUEST_REMINDER", metadata: { slot: 1, email: true, push: true } },
    ]);
  });

  it("15 dakikada bir kosan is ayni slotu ikinci kez gondermez; 24. saatte ikinci gider", async () => {
    addBooking();
    for (const m of [31, 46, 61, 600, 23 * 60 + 59]) await service.run({ now: at(m * MIN) });
    expect(h.send).toHaveBeenCalledTimes(1);

    await service.run({ now: at(24 * HOUR) });
    await service.run({ now: at(24 * HOUR + 15 * MIN) });
    expect(h.send).toHaveBeenCalledTimes(2);
    expect(h.db.events.map((e) => e.metadata.slot)).toEqual([1, 2]);
  });

  it("bir hafta boyunca 15 dakikada bir kossa bile toplam 7 hatirlatma", async () => {
    addBooking();
    for (let t = 0; t <= 10 * 24 * HOUR; t += 15 * MIN) await service.run({ now: at(t) });
    expect(h.send).toHaveBeenCalledTimes(7);
    expect(h.db.events.map((e) => e.metadata.slot)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("es zamanli calismalar ayni slotu bir kez gonderir", async () => {
    addBooking();
    const now = at(31 * MIN);
    const reports = await Promise.all([1, 2, 3, 4].map(() => service.run({ now })));
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.db.events).toHaveLength(1);
    expect(reports.reduce((n, r) => n + r.lostRace, 0)).toBe(3);
  });

  it("yeniden baslatma sonrasi (yeni servis ornegi) kayit tekrar gonderimi engeller", async () => {
    addBooking();
    await new OverdueGuestReminderService().run({ now: at(31 * MIN) });
    await new OverdueGuestReminderService().run({ now: at(40 * MIN) });
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it.each(["CHECKED_OUT", "CANCELLED"])("%s rezervasyona hatirlatma gitmez", async (status) => {
    addBooking({ status });
    await service.run({ now: at(2 * HOUR) });
    expect(h.send).not.toHaveBeenCalled();
  });

  it.each(["CHECKED_OUT", "CANCELLED"])(
    "tarama ile gonderim arasinda %s olursa kilit icinde yakalanir",
    async (status) => {
      addBooking();
      h.statusInsideLock.set("b1", status);
      const r = await service.run({ now: at(2 * HOUR) });
      expect(h.send).not.toHaveBeenCalled();
      expect(h.db.events).toHaveLength(0);
      expect(r.lostRace).toBe(1);
    },
  );

  it("e-postasiz (telefonla kayitli) misafir yine bildirilir: email null, push kanali acik", async () => {
    addBooking({ guest: { email: null }, guestEmail: null });
    await service.run({ now: at(31 * MIN) });
    expect(sentArgs()).toEqual([expect.objectContaining({ bookingId: "b1", email: null, hasAccount: true })]);
    expect(h.db.events[0].metadata).toMatchObject({ email: false, push: true });
  });

  it("hesapsiz misafir (yalnizca guestEmail) e-postayla bildirilir", async () => {
    addBooking({ guestId: null, guest: null, guestEmail: "walkin@example.com", locale: null });
    await service.run({ now: at(31 * MIN) });
    expect(sentArgs()).toEqual([
      expect.objectContaining({ email: "walkin@example.com", hasAccount: false, locale: "tr" }),
    ]);
    expect(h.db.events[0].metadata).toMatchObject({ email: true, push: false });
  });

  it("slotlarini bitirmis ve aylik bayat kayitlar ilk 100'u doldurmaz: yeni gecikmis misafir bildirilir", async () => {
    // 60 rezervasyon yedi slotunu bitirmis (alma saati 7 gun once), 60'i aylardir acik.
    for (let i = 0; i < 60; i++) {
      addBooking({ id: `done-${i}`, checkOutTime: new Date(CHECKOUT.getTime() - 170 * HOUR - i * MIN) });
      for (let s = 1; s <= 7; s++) {
        h.db.events.push({ bookingId: `done-${i}`, event: "OVERDUE_GUEST_REMINDER", metadata: { slot: s } });
      }
      addBooking({ id: `stale-${i}`, checkOutTime: new Date(CHECKOUT.getTime() - 120 * 24 * HOUR - i * MIN) });
    }
    addBooking({ id: "fresh", checkOutTime: CHECKOUT });

    const r = await service.run({ now: at(31 * MIN) });
    expect(sentArgs().map((a) => a.bookingId)).toEqual(["fresh"]);
    expect(r.limitReached).toBe(false);
  });

  it("hicbir kanali olmayan rezervasyon slot harcamaz ve gonderildi sayilmaz", async () => {
    addBooking({ guestId: null, guest: null, guestEmail: null });
    const r = await service.run({ now: at(31 * MIN) });
    expect(h.send).not.toHaveBeenCalled();
    expect(h.db.events).toHaveLength(0);
    expect(r).toMatchObject({ sent: 0, noChannel: 1 });
  });

  it("hicbir kanal basarili donmezse gonderildi sayilmaz, slot yine tekrar gitmez", async () => {
    addBooking({ guest: { email: null } });
    h.send.mockResolvedValueOnce({ push: false, email: false });
    const r = await service.run({ now: at(31 * MIN) });
    expect(r).toMatchObject({ sent: 0, undelivered: 1 });
    await service.run({ now: at(46 * MIN) });
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it("gonderim hatasi slotu yeniden denetmez (iki kez gitmesindense bir kez eksik)", async () => {
    addBooking();
    h.send.mockRejectedValueOnce(new Error("resend down"));
    await service.run({ now: at(31 * MIN) });
    await service.run({ now: at(46 * MIN) });
    expect(h.send).toHaveBeenCalledTimes(1);
  });
});

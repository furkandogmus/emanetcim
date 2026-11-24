import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * "Misafiri bekle": servis (`holdLateBooking`) ve mobil uc birlikte. Uc gercek
 * servisi cagirir; yetki kapisi (baska dukkanin esnafi) uctan olculur.
 */
const m = vi.hoisted(() => ({
  user: { id: "owner-1", role: "PARTNER" as string },
  prisma: { booking: { findUnique: vi.fn(), updateMany: vi.fn() }, shopMember: { findUnique: vi.fn().mockResolvedValue(null) } },
  record: vi.fn(),
  audit: vi.fn(),
  notice: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: m.audit }));
vi.mock("@/services/BookingEventService", () => ({ bookingEventService: { record: m.record } }));
vi.mock("@/services/NotificationService", () => ({ notificationService: { sendLateDropoffNotice: m.notice } }));
vi.mock("@/lib/mobile-auth", () => ({ requireMobileUser: vi.fn(async () => ({ user: m.user })) }));

import { holdLateBooking } from "@/services/booking/late-hold";
import { POST as holdRoute } from "@/app/api/mobile/partner/bookings/[id]/hold/route";

const CHECK_IN = new Date("2030-05-01T10:00:00Z");
const at = (n: number) => new Date(CHECK_IN.getTime() + n * 60_000);

function booking(over: Record<string, unknown> = {}) {
  return {
    id: "b1",
    status: "PAID",
    checkInTime: CHECK_IN,
    checkOutTime: at(120),
    checkedInAt: null,
    lateHoldUntil: null,
    guestId: "g1",
    guestEmail: null,
    locale: "tr",
    guest: { email: "misafir@ornek.com" },
    shop: { ownerId: "owner-1", name: "Ornek Dukkan", timezone: "Europe/Istanbul", owner: { phone: null } },
    ...over,
  };
}

const OWNER = { id: "owner-1", role: "PARTNER" as const };

beforeEach(() => {
  vi.clearAllMocks();
  m.user = { id: "owner-1", role: "PARTNER" };
  m.prisma.booking.findUnique.mockResolvedValue(booking());
  m.prisma.booking.updateMany.mockResolvedValue({ count: 1 });
  m.record.mockResolvedValue(undefined);
  m.notice.mockResolvedValue({ push: true, email: false });
});

describe("holdLateBooking", () => {
  it("kapanisi 30 dk ileri alir, KOSULLU yazar, olay yazar ve misafire bildirir", async () => {
    const r = await holdLateBooking("b1", OWNER, at(45));
    expect(r).toEqual({ ok: true, until: at(90) });
    expect(m.prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: "b1",
        status: { in: ["APPROVED", "PAID"] },
        checkedInAt: null,
        lateHoldUntil: null,
        checkInTime: CHECK_IN,
        checkOutTime: at(120),
      },
      data: { lateHoldUntil: at(90) },
    });
    expect(m.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: "LATE_HOLD", actorId: "owner-1", metadata: expect.objectContaining({ until: at(90).toISOString() }) }),
    );
    expect(m.notice).toHaveBeenCalledWith(expect.objectContaining({ kind: "hold", at: at(90) }));
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("ikinci basis okunan bekletmeyi kosul yapar (es zamanli iki basis iki kez eklemez)", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking({ lateHoldUntil: at(90) }));
    m.prisma.booking.updateMany.mockResolvedValue({ count: 0 });
    expect(await holdLateBooking("b1", OWNER, at(50))).toEqual({ ok: false, code: "INVALID_STATUS" });
    expect(m.prisma.booking.updateMany.mock.calls[0][0].where.lateHoldUntil).toEqual(at(90));
    expect(m.notice).not.toHaveBeenCalled();
  });

  it("suren bekletmeyi uzatmak misafire yeniden bildirim gondermez; bitmis bekletmeden sonra gonderir", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking({ lateHoldUntil: at(90) }));
    expect((await holdLateBooking("b1", OWNER, at(70))).ok).toBe(true);
    expect(m.notice).not.toHaveBeenCalled();
    m.prisma.booking.findUnique.mockResolvedValue(booking({ lateHoldUntil: at(90) }));
    expect((await holdLateBooking("b1", OWNER, at(91))).ok).toBe(true);
    expect(m.notice).toHaveBeenCalledTimes(1);
  });

  it("alma saatine dayandiysa HOLD_LIMIT, yazmaz", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking({ lateHoldUntil: at(120) }));
    expect(await holdLateBooking("b1", OWNER, at(60))).toEqual({ ok: false, code: "HOLD_LIMIT" });
    expect(m.prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("valiz birakildiysa INVALID_STATUS", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking({ status: "CHECKED_IN", checkedInAt: at(20) }));
    expect(await holdLateBooking("b1", OWNER, at(30))).toEqual({ ok: false, code: "INVALID_STATUS" });
  });

  it("yonetici de bekletebilir; denetim kaydi yazilir", async () => {
    const r = await holdLateBooking("b1", { id: "admin-1", role: "ADMIN" }, at(45));
    expect(r.ok).toBe(true);
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.booking.late_hold", entityId: "b1" }));
  });
});

describe("POST /api/mobile/partner/bookings/[id]/hold", () => {
  const params = { params: Promise.resolve({ id: "b1" }) };
  const req = () => new NextRequest("http://localhost/x", { method: "POST", body: "{}" });
  const call = async () => {
    const r = await holdRoute(req(), params);
    if (!r) throw new Error("uc yanit donmedi");
    return r;
  };

  it("baska dukkanin esnafi 403 forbidden, yazim yok", async () => {
    m.user = { id: "owner-2", role: "PARTNER" };
    const res = await call();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(m.prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("misafirin kendisi de bekletemez", async () => {
    m.user = { id: "g1", role: "GUEST" };
    expect((await call()).status).toBe(403);
  });

  it("dukkan sahibi: basarida { success: true }", async () => {
    vi.useFakeTimers({ now: at(45) });
    try {
      const res = await call();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("tavan: 400 hold_limit", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking({ lateHoldUntil: at(120) }));
    vi.useFakeTimers({ now: at(60) });
    try {
      const res = await call();
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "hold_limit" });
    } finally {
      vi.useRealTimers();
    }
  });
});

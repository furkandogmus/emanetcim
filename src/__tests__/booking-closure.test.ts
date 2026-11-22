import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Rezervasyon kapatma kapilari (`src/services/booking/closure.ts`): yetki,
 * durum, aciklama, "gelmedi" zaman siniri ve gece isinin secim penceresi.
 * Iptalin kendisi `cancelBooking`te; burada onun DOGRU nedenle cagrildigi
 * ve kapidan donenin cagrilmadigi olculur.
 */

const m = vi.hoisted(() => ({
  prisma: { booking: { findUnique: vi.fn(), findMany: vi.fn() } },
  cancelBooking: vi.fn(),
  checkOut: vi.fn(),
  audit: vi.fn(),
  notify: {
    notifyCheckOut: vi.fn(),
    pushGuestOnly: vi.fn(),
    notifyPartnerAdminAction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: m.audit }));
vi.mock("@/services/booking/lifecycle", () => ({ cancelBooking: m.cancelBooking }));
vi.mock("@/services/booking/check-out", () => ({ checkOut: m.checkOut }));
vi.mock("@/services/NotificationService", () => ({ notificationService: m.notify }));

import {
  adminCancelBooking,
  adminForceCheckOut,
  partnerCancelBooking,
  markNoShow,
  closeExpiredBookings,
  closeExpiredBookingsForGuest,
} from "@/services/booking/closure";

const ADMIN = { id: "admin-1", role: "ADMIN" as const };
const OWNER = { id: "owner-1", role: "PARTNER" as const };
const STRANGER = { id: "owner-2", role: "PARTNER" as const };
const CHECK_IN = new Date("2030-05-01T10:00:00Z");

function booking(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: "b1",
    status,
    checkInTime: CHECK_IN,
    guestId: "g1",
    guestEmail: null,
    locale: "en",
    guest: { email: "misafir@ornek.com" },
    shop: { ownerId: "owner-1" },
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.cancelBooking.mockResolvedValue({ ok: true, fullRefund: false });
  m.checkOut.mockResolvedValue({ ok: true });
  m.notify.notifyCheckOut.mockResolvedValue(undefined);
  m.notify.notifyPartnerAdminAction.mockResolvedValue(undefined);
});

describe("adminCancelBooking", () => {
  it("aciklamali iptal: cancelBooking admin_cancel ile, denetim kaydi yazilir", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("PAID"));
    const r = await adminCancelBooking("b1", ADMIN, { note: "  misafir aradi  ", ip: "1.2.3.4" });
    expect(r).toEqual({ ok: true });
    expect(m.cancelBooking).toHaveBeenCalledWith("b1", {
      actor: { id: "admin-1", role: "ADMIN", impersonatedBy: null },
      reason: "admin_cancel",
      note: "misafir aradi",
    });
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.booking.cancel", entityId: "b1", ip: "1.2.3.4" }),
    );
  });

  it("aciklama yoksa ya da 5 karakterden kisaysa note_required, iptal yok", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("PAID"));
    for (const note of [undefined, "", "   ", "abcd", 42]) {
      expect(await adminCancelBooking("b1", ADMIN, { note }), String(note)).toEqual({
        ok: false,
        code: "NOTE_REQUIRED",
      });
    }
    expect(m.cancelBooking).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it("CANCELLED / CHECKED_IN / CHECKED_OUT invalid_status", async () => {
    for (const status of ["CANCELLED", "CHECKED_IN", "CHECKED_OUT"]) {
      m.prisma.booking.findUnique.mockResolvedValue(booking(status));
      expect(await adminCancelBooking("b1", ADMIN, { note: "yeterli aciklama" }), status).toEqual({
        ok: false,
        code: "INVALID_STATUS",
      });
    }
    expect(m.cancelBooking).not.toHaveBeenCalled();
  });

  it("check-in oncesi her durum iptal edilebilir", async () => {
    for (const status of ["PENDING", "WAITING_APPROVAL", "APPROVED", "PAID"]) {
      m.prisma.booking.findUnique.mockResolvedValue(booking(status));
      expect((await adminCancelBooking("b1", ADMIN, { note: "yeterli aciklama" })).ok, status).toBe(true);
    }
  });

  it("admin olmayan forbidden; olmayan kayit not_found", async () => {
    expect(await adminCancelBooking("b1", OWNER, { note: "yeterli aciklama" })).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
    m.prisma.booking.findUnique.mockResolvedValue(null);
    expect(await adminCancelBooking("yok", ADMIN, { note: "yeterli aciklama" })).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("cift iptal: ikinci cagri kilidi kaybeder, invalid_status ve ikinci denetim kaydi yok", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("PAID"));
    m.cancelBooking
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, code: "INVALID_STATUS", message: "x" });
    expect((await adminCancelBooking("b1", ADMIN, { note: "yeterli aciklama" })).ok).toBe(true);
    expect(await adminCancelBooking("b1", ADMIN, { note: "yeterli aciklama" })).toEqual({
      ok: false,
      code: "INVALID_STATUS",
    });
    expect(m.audit).toHaveBeenCalledTimes(1);
  });
});

describe("adminForceCheckOut", () => {
  it("yalniz CHECKED_IN; checkOut forced ile, denetim + bildirim", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("CHECKED_IN"));
    const r = await adminForceCheckOut("b1", ADMIN, { note: "misafir dukkana geldi" });
    expect(r).toEqual({ ok: true });
    expect(m.checkOut).toHaveBeenCalledWith("b1", {
      actor: { id: "admin-1", role: "ADMIN", impersonatedBy: null },
      forced: { note: "misafir dukkana geldi" },
    });
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.booking.force_checkout" }));
    expect(m.notify.notifyCheckOut).toHaveBeenCalledWith("misafir@ornek.com", "b1", "en");
    expect(m.notify.notifyPartnerAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "b1", kind: "force_checked_out" }),
    );
  });

  it("e-postasi olmayan misafire yalniz push", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("CHECKED_IN", { guest: null }));
    await adminForceCheckOut("b1", ADMIN, { note: "misafir dukkana geldi" });
    expect(m.notify.notifyCheckOut).not.toHaveBeenCalled();
    expect(m.notify.pushGuestOnly).toHaveBeenCalledWith("b1", "checkOut", "en");
  });

  it("CHECKED_IN degilse invalid_status; aciklamasiz note_required", async () => {
    for (const status of ["PAID", "APPROVED", "CHECKED_OUT", "CANCELLED"]) {
      m.prisma.booking.findUnique.mockResolvedValue(booking(status));
      expect(await adminForceCheckOut("b1", ADMIN, { note: "yeterli aciklama" }), status).toEqual({
        ok: false,
        code: "INVALID_STATUS",
      });
    }
    m.prisma.booking.findUnique.mockResolvedValue(booking("CHECKED_IN"));
    expect(await adminForceCheckOut("b1", ADMIN, { note: "x" })).toEqual({ ok: false, code: "NOTE_REQUIRED" });
    expect(m.checkOut).not.toHaveBeenCalled();
  });

  it("checkOut yarisi kaybederse invalid_status ve denetim kaydi yok", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("CHECKED_IN"));
    m.checkOut.mockResolvedValue({ ok: false, code: "INVALID_STATUS", message: "x" });
    expect(await adminForceCheckOut("b1", ADMIN, { note: "yeterli aciklama" })).toEqual({
      ok: false,
      code: "INVALID_STATUS",
    });
    expect(m.audit).not.toHaveBeenCalled();
  });
});

describe("partnerCancelBooking", () => {
  it("dukkan sahibi nedenle iptal eder: partner_cancel + alt neden", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("APPROVED"));
    expect(await partnerCancelBooking("b1", OWNER, { reason: "shop_closed" })).toEqual({ ok: true });
    expect(m.cancelBooking).toHaveBeenCalledWith("b1", {
      actor: { id: "owner-1", role: "PARTNER", impersonatedBy: null },
      reason: "partner_cancel",
      detail: "shop_closed",
      note: null,
    });
  });

  it("baska dukkanin esnafi forbidden", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("APPROVED"));
    expect(await partnerCancelBooking("b1", STRANGER, { reason: "capacity" })).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(m.cancelBooking).not.toHaveBeenCalled();
  });

  it("bilinmeyen neden invalid_reason; 'other' aciklamasiz note_required", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("PAID"));
    expect(await partnerCancelBooking("b1", OWNER, { reason: "bored" })).toEqual({
      ok: false,
      code: "INVALID_REASON",
    });
    expect(await partnerCancelBooking("b1", OWNER, { reason: "other", note: "  " })).toEqual({
      ok: false,
      code: "NOTE_REQUIRED",
    });
    expect(await partnerCancelBooking("b1", OWNER, { reason: "other", note: "su kesildi" })).toEqual({ ok: true });
    expect(m.cancelBooking).toHaveBeenCalledTimes(1);
  });

  it("valiz birakildiysa (CHECKED_IN) ya da kapanmissa invalid_status", async () => {
    for (const status of ["CHECKED_IN", "CHECKED_OUT", "CANCELLED"]) {
      m.prisma.booking.findUnique.mockResolvedValue(booking(status));
      expect(await partnerCancelBooking("b1", OWNER, { reason: "capacity" }), status).toEqual({
        ok: false,
        code: "INVALID_STATUS",
      });
    }
  });

  it("admin de esnaf iptali yapabilir", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("PENDING"));
    expect((await partnerCancelBooking("b1", ADMIN, { reason: "guest_request" })).ok).toBe(true);
  });
});

describe("markNoShow", () => {
  const at = (minutes: number) => new Date(CHECK_IN.getTime() + minutes * 60_000);

  it("check-in + 60 dk'dan once too_early, tam sinirda izin verir", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("APPROVED"));
    expect(await markNoShow("b1", OWNER, at(59))).toEqual({ ok: false, code: "TOO_EARLY" });
    expect(await markNoShow("b1", OWNER, new Date(at(60).getTime() - 1))).toEqual({
      ok: false,
      code: "TOO_EARLY",
    });
    expect(m.cancelBooking).not.toHaveBeenCalled();

    expect(await markNoShow("b1", OWNER, at(60))).toEqual({ ok: true });
    expect(m.cancelBooking).toHaveBeenCalledWith("b1", {
      actor: { id: "owner-1", role: "PARTNER", impersonatedBy: null },
      reason: "no_show",
    });
  });

  it("valiz birakilmis ya da kapanmis kayit invalid_status", async () => {
    for (const status of ["CHECKED_IN", "CHECKED_OUT", "CANCELLED"]) {
      m.prisma.booking.findUnique.mockResolvedValue(booking(status));
      expect(await markNoShow("b1", OWNER, at(600)), status).toEqual({ ok: false, code: "INVALID_STATUS" });
    }
  });

  it("baska dukkanin esnafi forbidden, olmayan kayit not_found", async () => {
    m.prisma.booking.findUnique.mockResolvedValue(booking("PAID"));
    expect(await markNoShow("b1", STRANGER, at(600))).toEqual({ ok: false, code: "FORBIDDEN" });
    m.prisma.booking.findUnique.mockResolvedValue(null);
    expect(await markNoShow("b1", OWNER, at(600))).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});

describe("closeExpiredBookings (gece isi)", () => {
  const NOW = new Date("2030-05-02T03:00:00Z");

  it("pencere: birakilmamis durumlar, checkOutTime < simdi - 6 saat, check-in yok", async () => {
    m.prisma.booking.findMany.mockResolvedValue([]);
    await closeExpiredBookings({ now: NOW });
    const { where } = m.prisma.booking.findMany.mock.calls[0][0];
    expect(where.status.in.sort()).toEqual(["APPROVED", "PAID", "PENDING", "WAITING_APPROVAL"]);
    expect(where.checkOutTime.lt).toEqual(new Date("2030-05-01T21:00:00Z"));
    expect(where.checkedInAt).toBeNull();
  });

  it("her kayit sessiz expired_no_dropoff ile kapanir; sayilar doner", async () => {
    m.prisma.booking.findMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
    m.cancelBooking
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, code: "INVALID_STATUS", message: "x" });
    const r = await closeExpiredBookings({ now: NOW, batchSize: 10 });
    expect(r).toEqual({ scanned: 2, closed: 1, failed: 1 });
    expect(m.cancelBooking).toHaveBeenCalledWith("a", { silent: true, reason: "expired_no_dropoff" });
  });

  it("toplu calisir ve ayni kosuda denenmis kaydi bir daha secmez", async () => {
    m.prisma.booking.findMany
      .mockResolvedValueOnce([{ id: "a" }, { id: "b" }])
      .mockResolvedValueOnce([{ id: "c" }]);
    const r = await closeExpiredBookings({ now: NOW, batchSize: 2 });
    expect(r.closed).toBe(3);
    expect(m.prisma.booking.findMany).toHaveBeenCalledTimes(2);
    expect(m.prisma.booking.findMany.mock.calls[1][0].where.id).toEqual({ notIn: ["a", "b"] });
  });

  it("tekrar calistirmak zararsiz: kapanacak kayit yoksa hicbir sey iptal edilmez", async () => {
    m.prisma.booking.findMany.mockResolvedValue([]);
    expect(await closeExpiredBookings({ now: NOW })).toEqual({ scanned: 0, closed: 0, failed: 0 });
    expect(m.cancelBooking).not.toHaveBeenCalled();
  });

  it("maxBatches tavani sonsuz donguyu engeller", async () => {
    let n = 0;
    m.prisma.booking.findMany.mockImplementation(async () => [{ id: `x${n++}` }]);
    await closeExpiredBookings({ now: NOW, batchSize: 1, maxBatches: 3 });
    expect(m.prisma.booking.findMany).toHaveBeenCalledTimes(3);
  });
});

describe("closeExpiredBookingsForGuest (hesap silme)", () => {
  it("misafirin alma saati gecmis, birakilmamis kayitlarini kapatir (6 saat payi yok)", async () => {
    const now = new Date("2030-05-02T03:00:00Z");
    m.prisma.booking.findMany.mockResolvedValue([{ id: "a" }]);
    expect(await closeExpiredBookingsForGuest("g1", now)).toBe(1);
    const { where } = m.prisma.booking.findMany.mock.calls[0][0];
    expect(where.guestId).toBe("g1");
    expect(where.checkOutTime.lt).toEqual(now);
    expect(m.cancelBooking).toHaveBeenCalledWith("a", { silent: true, reason: "expired_no_dropoff" });
  });
});

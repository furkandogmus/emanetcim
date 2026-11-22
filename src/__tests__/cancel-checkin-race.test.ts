import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * IPTAL ile CHECK-IN YARISI. Check-in satiri okuyup kontrolleri yaparken
 * araya bir iptal girerse, check-in'in kosullu yazimi KAYBETMELI: aksi halde
 * slotlari bosaltilmis ve iadesi yazilmis CANCELLED kayit CHECKED_IN olur.
 *
 * Satir sahte bir bellek kaydi; `updateMany` gercek `where`i (id, durum,
 * surum) uygular. Iptal, check-in'in bayat okumasindan SONRA calisir.
 */


const m = vi.hoisted(() => {
  type Row = { id: string; status: string; bookingRowVersion: number; [k: string]: unknown };
  const state = {
    row: null as unknown as Row,
    duringCheckIn: (async () => {}) as () => Promise<void>,
  };
  const matches = (row: Row, where: Record<string, unknown>): boolean => {
    if (where.id !== undefined && where.id !== row.id) return false;
    if (where.bookingRowVersion !== undefined && where.bookingRowVersion !== row.bookingRowVersion) return false;
    const st = where.status as { in?: string[]; notIn?: string[] } | string | undefined;
    if (typeof st === "string" && st !== row.status) return false;
    if (st && typeof st === "object") {
      if (st.in && !st.in.includes(row.status)) return false;
      if (st.notIn && st.notIn.includes(row.status)) return false;
    }
    return true;
  };
  const apply = (row: Row, data: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "increment" in (v as object)) {
        row[k] = (row[k] as number) + (v as { increment: number }).increment;
      } else row[k] = v;
    }
  };
  const prisma: Record<string, unknown> = {
    booking: {
      findUnique: async () => ({
        ...state.row,
        shop: { ownerId: "owner-1", open247: true, openingTime: null, closingTime: null, timezone: "Europe/Istanbul" },
        seals: [],
        reservationSlots: [],
      }),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!matches(state.row, where)) return { count: 0 };
        apply(state.row, data);
        return { count: 1 };
      },
    },
    paymentLog: { findFirst: async () => null },
    reservationSlot: { deleteMany: async () => ({ count: 0 }) },
    $executeRaw: async () => 0,
  };
  prisma.$transaction = async (f: (tx: unknown) => unknown) => f(prisma);
  return Object.assign(state, { prisma });
});

vi.mock("@/lib/db", () => ({ default: m.prisma }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: vi.fn(async () => ({ requireSealsOnCheckIn: false, checkInGraceMin: 0 })),
}));
vi.mock("@/services/ShopScheduleService", () => ({
  loadScheduleParts: vi.fn(async () => new Map()),
  findClosedStayDay: vi.fn(),
  isClosedAtStayTimes: vi.fn(),
}));
vi.mock("@/lib/shop-schedule", () => ({ isOpenForHandover: () => true }));
vi.mock("@/services/SealService", () => ({ sealService: { applyCheckInWithinTx: vi.fn() } }));
vi.mock("@/services/BookingEventService", () => ({ bookingEventService: { record: vi.fn(async () => undefined) } }));
vi.mock("@/services/CouponService", () => ({ couponService: { releaseByCode: vi.fn(async () => undefined) } }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyPartnerBookingChange: vi.fn(async () => undefined),
    notifyGuestBookingClosed: vi.fn(async () => undefined),
    notifyPartnerAdminAction: vi.fn(async () => undefined),
  },
}));
vi.mock("@/services/PaymentService", () => ({
  paymentService: {
    // Check-in kontrollerini gecti, yazmadan hemen once: iptal araya girer.
    hasCapturedPayment: vi.fn(async () => {
      await m.duringCheckIn();
      return true;
    }),
    refund: vi.fn(async () => ({ ok: true })),
    cancelIntent: vi.fn(async () => undefined),
    capabilities: { capturesOnline: false },
  },
}));

import { cancelBooking } from "@/services/booking/lifecycle";
import { checkIn } from "@/services/booking/check-in";

beforeEach(() => {
  vi.clearAllMocks();
  m.row = { id: "b1", status: "APPROVED", bookingRowVersion: 0, couponCode: null, locale: "tr", bagCountS: 1, bagCountM: 0, bagCountXl: 0, totalPrice: 100, shopId: "s1" };
  m.duringCheckIn = async () => {};
});

describe("iptal ile check-in yarisi", () => {
  it("iptalden once okumus bir check-in iptal edilmis kaydi CHECKED_IN yapamaz", async () => {
    m.duringCheckIn = async () => {
      expect((await cancelBooking("b1", { silent: true, reason: "guest_cancel" })).ok).toBe(true);
    };
    const r = await checkIn("b1");
    expect(r.ok).toBe(false);
    expect(m.row.status).toBe("CANCELLED");
    expect(m.row.checkedInAt).toBeUndefined();
  });

  it("iptal kilidi surumu artirir", async () => {
    await cancelBooking("b1", { silent: true });
    expect(m.row).toMatchObject({ status: "CANCELLED", bookingRowVersion: 1 });
  });

  it("surum degismese bile check-in yazimi durumu kosul olarak arar", async () => {
    // Surumu artirmayan eski/baska bir yazim yolunu taklit eder.
    m.duringCheckIn = async () => {
      m.row.status = "CANCELLED";
    };
    const r = await checkIn("b1");
    expect(r.ok).toBe(false);
    expect(m.row.status).toBe("CANCELLED");
  });

  it("yaris yoksa check-in gecer (sahte satir dogru calisiyor)", async () => {
    const r = await checkIn("b1");
    expect(r.ok).toBe(true);
    expect(m.row.status).toBe("CHECKED_IN");
  });
});

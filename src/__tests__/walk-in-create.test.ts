import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Kapidan gelen misafir rezervasyonu `booking/create` icinde: hesapsiz, indirimsiz, ama
 * kapasite / saat / tatil kurallari normal yolla ayni. Kanal (`source`) yalniz burada yazilir.
 */
const { mockPrisma, tx, mockClosedAt, mockRecord, RULES } = vi.hoisted(() => {
  const tx = {
    shop: { findUnique: vi.fn() },
    $executeRaw: vi.fn().mockResolvedValue(1),
    booking: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  return {
    tx,
    mockClosedAt: vi.fn(),
    mockRecord: vi.fn().mockResolvedValue(undefined),
    RULES: {
      maxStayDays: 30,
      maxBagsPerSlot: 50,
      insuranceFeeTry: 0,
      defaultPricePerDay: 250,
      platformHolidayDates: [] as string[],
      requireSealsOnCheckIn: false,
    },
    mockPrisma: {
      $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
      shop: { findUnique: vi.fn() },
      booking: { findUnique: vi.fn() },
    },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/ShopScheduleService", () => ({
  findClosedStayDay: vi.fn().mockResolvedValue(null),
  isClosedAtStayTimes: mockClosedAt,
}));
vi.mock("@/lib/platform-settings", () => ({ getPricingRules: vi.fn(async () => RULES) }));
vi.mock("@/services/BookingEventService", () => ({ bookingEventService: { record: mockRecord } }));
vi.mock("@/services/AffiliateService", () => ({ affiliateService: { resolve: vi.fn() } }));

import { createInitialBooking, createWalkInBooking } from "@/services/booking/create";

process.env.AUTH_SECRET ??= crypto.randomUUID() + crypto.randomUUID();

const NOW = Date.now();
const BASE = {
  shopId: "shop-1",
  totalPrice: 250,
  bagCountS: 0,
  bagCountM: 2,
  bagCountXl: 0,
  checkInTime: new Date(NOW),
  checkOutTime: new Date(NOW + 4 * 60 * 60 * 1000),
};
const WALK_IN = {
  operator: { id: "staff-1", role: "GUEST" as const },
  guestName: "Ada",
  guestEmail: null,
  guestPhone: "+905550000000",
  eventMetadata: { channel: "walk_in", operatorRelation: "staff", consent: { confirmedByOperator: true } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockClosedAt.mockResolvedValue(false);
  mockPrisma.shop.findUnique.mockResolvedValue({ isPrelaunch: false });
  tx.shop.findUnique.mockResolvedValue({ id: "shop-1", capacity: 10, pricePerDay: 250 });
  tx.booking.findMany.mockResolvedValue([]);
  tx.booking.create.mockImplementation(async ({ data }) => ({ id: "b-1", ...data }));
  tx.booking.update.mockImplementation(async ({ data }) => ({ id: "b-1", ...tx.booking.create.mock.calls[0][0].data, ...data }));
});

describe("createWalkInBooking", () => {
  it("hesapsiz, walk_in kanalli, adi ve iletisimi yazili, indirimsiz APPROVED", async () => {
    const b = await createWalkInBooking(BASE, WALK_IN);
    const data = tx.booking.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      guestId: null,
      guestName: "Ada",
      guestPhone: "+905550000000",
      guestEmail: null,
      source: "walk_in",
      sourceShopId: null,
      status: "APPROVED",
      affiliateId: null,
      couponDiscountAmount: 0,
      referralDiscountAmount: 0,
    });
    expect(b.qrCodeToken).toBeTruthy();
  });

  it("olay satirinin aktoru operator; KVKK beyani metadata'da", async () => {
    await createWalkInBooking(BASE, WALK_IN);
    const created = mockRecord.mock.calls.find((c) => c[0].event === "CREATED")![0];
    expect(created).toMatchObject({ actorId: "staff-1", actorRole: "GUEST" });
    expect(created.metadata).toMatchObject({ source: "walk_in", channel: "walk_in", consent: { confirmedByOperator: true } });
    const approved = mockRecord.mock.calls.find((c) => c[0].event === "APPROVED")![0];
    expect(approved.actorId).toBe("staff-1");
  });

  it("kapasite asilirsa reddeder", async () => {
    tx.booking.findMany.mockResolvedValue([{ bagCountS: 0, bagCountM: 9, bagCountXl: 0 }]);
    await expect(createWalkInBooking(BASE, WALK_IN)).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED" });
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("alma saatinde dukkan kapaliysa reddeder", async () => {
    mockClosedAt.mockResolvedValue(true);
    await expect(createWalkInBooking(BASE, WALK_IN)).rejects.toMatchObject({ code: "SHOP_CLOSED_ON_DATE" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("1 saatten kisa pencere reddedilir", async () => {
    await expect(
      createWalkInBooking({ ...BASE, checkOutTime: new Date(NOW + 30 * 60 * 1000) }, WALK_IN),
    ).rejects.toMatchObject({ code: "INVALID_DATES" });
  });

  it("talep testi noktasinda acilmaz", async () => {
    mockPrisma.shop.findUnique.mockResolvedValue({ isPrelaunch: true });
    await expect(createWalkInBooking(BASE, WALK_IN)).rejects.toMatchObject({ code: "SHOP_PRELAUNCH" });
  });
});

describe("createInitialBooking kanal alanlari", () => {
  const GUEST = { ...BASE, guestId: "g1", initialStatus: "APPROVED" as const };

  it("afis kanalinda afis dukkani yazilir", async () => {
    await createInitialBooking({ ...GUEST, source: "poster", sourceShopId: "shop-9" });
    expect(tx.booking.create.mock.calls[0][0].data).toMatchObject({ source: "poster", sourceShopId: "shop-9", guestId: "g1" });
  });

  it("afis disinda dukkan yazilmaz (istemci sizdirsa da)", async () => {
    await createInitialBooking({ ...GUEST, source: "web", sourceShopId: "shop-9" });
    expect(tx.booking.create.mock.calls[0][0].data).toMatchObject({ source: "web", sourceShopId: null });
  });

  it("oturumsuz normal yol hala reddedilir (walk-in istisnasi sizmaz)", async () => {
    await expect(createInitialBooking({ ...GUEST, guestId: "" })).rejects.toMatchObject({ code: "LOGIN_REQUIRED" });
  });
});

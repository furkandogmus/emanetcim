/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingService } from "../services/BookingService";

/**
 * İki rezervasyon yolunun kapasite doğruluğu.
 *
 * Neden var (P1-2): iki yol iki AYRI kapasite doğruluğu kullanıyordu ve birbirini
 * görmüyordu.
 *   - Legacy yol örtüşen `Booking` satırlarını sayar, `ReservationSlot` YAZMAZ.
 *   - Slot yolu yalnızca `ReservationSlot` satırlarını sayardı.
 * Prod'da `ReservationSlot` tamamen boş (19 rezervasyona karşı 0 satır), yani her
 * mevcut rezervasyon slot yolu için görünmezdi ve slot yolu fiziksel dükkan
 * kapasitesini aşan rezervasyon alabilirdi. Fiziksel sonucu: dükkana sığandan
 * fazla bavul gelir.
 */

const { mockTx, mockPrisma, mockReserveSlots } = vi.hoisted(() => {
  const mockTx = {
    shop: { findUnique: vi.fn() },
    booking: {
      create: vi.fn().mockResolvedValue({ id: "new-booking" }),
      update: vi.fn().mockResolvedValue({ id: "new-booking" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    shopTimeSlot: { findMany: vi.fn().mockResolvedValue([]) },
    reservationSlot: { createMany: vi.fn() },
    $executeRaw: vi.fn().mockResolvedValue(0),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
  };
  return {
    mockTx,
    mockReserveSlots: vi.fn(),
    mockPrisma: {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<any>) => fn(mockTx)),
      ...mockTx,
    },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/platform-settings", () => ({
  getPricingRules: vi.fn().mockResolvedValue({
    maxStayDays: 30,
    maxBagsPerSlot: 50,
    insuranceFeeTry: 0,
    earlyRefundRatio: 1,
    cancelFixedFeeTry: 0,
    latePickupFeeTry: 0,
    latePickupGraceMin: 15,
    defaultShopCapacity: 10,
    defaultPricePerDay: 50,
    bagMultipliers: { S: 0.8, M: 1, XL: 1.5 },
    platformHolidayDates: [],
  }),
  getPricingRulesCached: vi.fn(),
}));
vi.mock("@/services/SlotService", () => ({
  reserveSlots: mockReserveSlots,
  releaseSlots: vi.fn(),
}));
vi.mock("@/lib/qr-token", () => ({
  createQrToken: vi.fn().mockResolvedValue("token"),
  verifyQrToken: vi.fn(),
}));
vi.mock("@/services/SealService", () => ({ sealService: {} }));

const IN = new Date(Date.now() + 3 * 60 * 60 * 1000);
const OUT = new Date(Date.now() + 9 * 60 * 60 * 1000);

function input(bags: number, slotIds?: string[]) {
  return {
    shopId: "shop-1",
    totalPrice: 100,
    bagCountS: 0,
    bagCountM: bags,
    bagCountXl: 0,
    checkInTime: IN,
    checkOutTime: OUT,
    ...(slotIds ? { slotIds } : {}),
  };
}

/** Dükkanda `bags` valizlik yer kaplayan, legacy yolla yapılmış bir rezervasyon. */
function legacyBooking(bags: number) {
  return { bagCountS: 0, bagCountM: bags, bagCountXl: 0 };
}

describe("kapasite: fiziksel sınır her iki yolda da tutar", () => {
  const service = new BookingService();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.shop.findUnique.mockResolvedValue({
      id: "shop-1",
      capacity: 10,
      pricePerDay: 50,
      pricePerHour: 10,
    });
    mockTx.booking.findMany.mockResolvedValue([]);
    mockTx.booking.create.mockResolvedValue({ id: "new-booking" });
    mockTx.booking.update.mockResolvedValue({ id: "new-booking" });
    mockTx.shopTimeSlot.findMany.mockResolvedValue([{ id: "slot-1" }]);
    mockReserveSlots.mockResolvedValue({
      slots: [{ id: "slot-1" }],
      data: [],
      checkInTime: IN,
      checkOutTime: OUT,
    });
  });

  it("legacy yol dükkan kapasitesini aşmaya izin vermez", async () => {
    mockTx.booking.findMany.mockResolvedValue([legacyBooking(8)]);

    await expect(service.createInitialBooking(input(5) as any)).rejects.toThrow(
      /kapasite/i,
    );
  });

  it("SLOT yolu, LEGACY rezervasyonları artık görüyor — karışık mod aşırı rezervasyon", async () => {
    // Bu, P1-2'nin ta kendisi: dukkanda legacy yolla 8 valiz var, ReservationSlot
    // bos oldugu icin reserveSlots bunu GORMUYOR ve 5 valiz daha kabul ediyordu.
    // 8 + 5 = 13 > 10 -> dukkana sigandan fazla bavul.
    mockTx.booking.findMany.mockResolvedValue([legacyBooking(8)]);

    await expect(
      service.createInitialBooking(input(5, ["slot-1"]) as any),
    ).rejects.toThrow(/kapasite/i);

    // Slot rezervasyonu yapildi ama dukkan siniri devreye girip islemi durdurdu.
    expect(mockReserveSlots).toHaveBeenCalled();
    expect(mockTx.booking.create).not.toHaveBeenCalled();
  });

  it("kapasite yeterliyse slot yolu normal çalışır", async () => {
    mockTx.booking.findMany.mockResolvedValue([legacyBooking(3)]);

    await expect(
      service.createInitialBooking(input(5, ["slot-1"]) as any),
    ).resolves.toBeTruthy();

    expect(mockTx.booking.create).toHaveBeenCalled();
  });

  it("tam kapasitede kabul edilir, bir fazlasında reddedilir", async () => {
    mockTx.booking.findMany.mockResolvedValue([legacyBooking(7)]);
    await expect(
      service.createInitialBooking(input(3, ["slot-1"]) as any),
    ).resolves.toBeTruthy();

    vi.clearAllMocks();
    mockTx.shop.findUnique.mockResolvedValue({
      id: "shop-1", capacity: 10, pricePerDay: 50, pricePerHour: 10,
    });
    mockTx.shopTimeSlot.findMany.mockResolvedValue([{ id: "slot-1" }]);
    mockReserveSlots.mockResolvedValue({
      slots: [{ id: "slot-1" }], data: [], checkInTime: IN, checkOutTime: OUT,
    });
    mockTx.booking.findMany.mockResolvedValue([legacyBooking(7)]);

    await expect(
      service.createInitialBooking(input(4, ["slot-1"]) as any),
    ).rejects.toThrow(/kapasite/i);
  });

  it("slot yolu dükkan kontrolünü rezerve edilmiş pencereyle yapar, istenenle değil", async () => {
    // reserveSlots pencereyi slot sinirlarina yuvarlayabilir; kaydedilen odur,
    // dolayisiyla kapasite de onunla olculmeli.
    const snappedIn = new Date(IN.getTime() + 15 * 60 * 1000);
    const snappedOut = new Date(OUT.getTime() - 15 * 60 * 1000);
    mockReserveSlots.mockResolvedValue({
      slots: [{ id: "slot-1" }],
      data: [],
      checkInTime: snappedIn,
      checkOutTime: snappedOut,
    });

    await service.createInitialBooking(input(2, ["slot-1"]) as any);

    /*
      NIYET: kullanilan PENCERE dogru mu -- yani `snapped*` degerleri mi
      sorgulaniyor. Onceki hal `where.AND`in TAM SEKLINI dogruluyordu ve bu
      testi asiri hassas yapiyordu: 2026-09-01'de ortusme kosuluna "rafta duran
      valiz" dali eklenince (cikis saati gecmis `CHECKED_IN` rezervasyonlar
      kapasiteden dusulmuyordu) sekil degisti ve test, DAVRANIS dogru oldugu
      halde kirildi. Artik degerler dogrulaniyor, dizilim degil.
    */
    const capacityQuery = mockTx.booking.findMany.mock.calls[0][0];
    const and = capacityQuery.where.AND;
    expect(and).toContainEqual({ checkInTime: { lt: snappedOut } });
    const overlap = and.find((c: { OR?: unknown[] }) => Array.isArray(c.OR));
    expect(overlap.OR).toContainEqual({ checkOutTime: { gt: snappedIn } });
  });
});

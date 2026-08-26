import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Valiz revizyonu — web'in iki adimli ve mobilin tek adimli akisinin ORTAK govdesi.
 *
 * NEDEN BU DOSYA VAR (2026-08-25): ayni islem iki yerde yaziliydi ve ikisi de
 * PARA alanlarina (`totalPrice`, `insuranceFee`) yaziyordu. Uc noktada ayrisimisti:
 * durum kosulu birbirinin TERSIYDI, mobil `pendingBagRevision`'i temizlemiyordu
 * (eski oneri sonradan bir kez daha uygulanabiliyordu) ve `unitPrice` farkli
 * yaziliyordu.
 */

const { mockPrisma, mockEvents, mockGetPricingRules, RULES } = vi.hoisted(() => {
  const RULES = {
    maxStayDays: 30,
    maxBagsPerSlot: 50,
    insuranceFeeTry: 10,
    earlyRefundRatio: 1,
    cancelFixedFeeTry: 0,
    latePickupFeeTry: 0,
    latePickupGraceMin: 15,
    defaultShopCapacity: 10,
    defaultPricePerDay: 50,
    bagMultipliers: { S: 0.8, M: 1.0, XL: 1.5 },
    platformHolidayDates: [],
    requireSealsOnCheckIn: false,
  };
  return {
    RULES,
    mockGetPricingRules: vi.fn().mockResolvedValue(RULES),
    mockPrisma: { booking: { findUnique: vi.fn(), update: vi.fn() } },
    mockEvents: { record: vi.fn().mockResolvedValue(undefined) },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/BookingEventService", () => ({ bookingEventService: mockEvents }));
vi.mock("@/lib/platform-settings", () => ({ getPricingRules: mockGetPricingRules }));

import { applyBagRevision, proposeBagRevision, clearBagRevision } from "@/services/booking/bag-revision";

const PARTNER = { id: "owner-1", role: "PARTNER" as const };

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b1",
    status: "PAID",
    bagCountS: 1,
    bagCountM: 1,
    bagCountXl: 0,
    totalPrice: 100,
    pricingSnapshot: null,
    pendingBagRevision: null,
    checkInTime: new Date("2026-09-01T09:00:00Z"),
    checkOutTime: new Date("2026-09-01T18:00:00Z"),
    shop: { ownerId: "owner-1", pricePerDay: 50 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPricingRules.mockResolvedValue(RULES);
});

describe("applyBagRevision", () => {
  it("bekleyen öneriyi HER DURUMDA temizler — mobil uç temizlemiyordu", async () => {
    // Temizlenmezse: web'den onerilmis eski bir revizyon mobil duzeltmeden sonra
    // kayitta kalir ve guncellenmis sayilarin uzerine BIR KEZ DAHA uygulanabilir.
    mockPrisma.booking.findUnique.mockResolvedValue(
      booking({ pendingBagRevision: { bagCountS: 9, bagCountM: 9, bagCountXl: 9 } }),
    );

    const result = await applyBagRevision("b1", PARTNER, {
      counts: { bagCountS: 2, bagCountM: 0, bagCountXl: 1 },
      source: "mobile",
    });

    expect(result.ok).toBe(true);
    expect(mockPrisma.booking.update.mock.calls[0][0].data.pendingBagRevision).toBeDefined();
    // `Prisma.JsonNull` sentinel'i — degeri degil, VARLIGI onemli.
    expect(mockPrisma.booking.update.mock.calls[0][0].data.pendingBagRevision).not.toBeNull();
  });

  it("sayıları ve tutarı TEK update ile birlikte yazar", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking());

    await applyBagRevision("b1", PARTNER, {
      counts: { bagCountS: 2, bagCountM: 1, bagCountXl: 0 },
    });

    expect(mockPrisma.booking.update).toHaveBeenCalledTimes(1);
    const data = mockPrisma.booking.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ bagCountS: 2, bagCountM: 1, bagCountXl: 0 });
    expect(typeof data.totalPrice).toBe("number");
    expect(typeof data.insuranceFee).toBe("number");
  });

  it("bekleyen öneri yoksa ve sayı verilmediyse reddeder", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking());
    expect(await applyBagRevision("b1", PARTNER)).toEqual({
      ok: false,
      code: "NO_PENDING_REVISION",
    });
    expect(mockPrisma.booking.update).not.toHaveBeenCalled();
  });

  it("bekleyen öneri varsa onu kullanır (web'in iki adımlı akışı)", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(
      booking({ pendingBagRevision: { bagCountS: 3, bagCountM: 2, bagCountXl: 1 } }),
    );

    await applyBagRevision("b1", PARTNER, { source: "web" });

    expect(mockPrisma.booking.update.mock.calls[0][0].data).toMatchObject({
      bagCountS: 3,
      bagCountM: 2,
      bagCountXl: 1,
    });
  });

  it("durum koşulu web ve mobilin BİRLEŞİMİ", async () => {
    for (const status of ["APPROVED", "PAID", "CHECKED_IN"]) {
      vi.clearAllMocks();
      mockGetPricingRules.mockResolvedValue(RULES);
      mockPrisma.booking.findUnique.mockResolvedValue(booking({ status }));
      const r = await applyBagRevision("b1", PARTNER, {
        counts: { bagCountS: 1, bagCountM: 1, bagCountXl: 0 },
      });
      expect(r.ok, status).toBe(true);
    }
    for (const status of ["PENDING", "WAITING_APPROVAL", "CANCELLED", "CHECKED_OUT"]) {
      vi.clearAllMocks();
      mockGetPricingRules.mockResolvedValue(RULES);
      mockPrisma.booking.findUnique.mockResolvedValue(booking({ status }));
      const r = await applyBagRevision("b1", PARTNER, {
        counts: { bagCountS: 1, bagCountM: 1, bagCountXl: 0 },
      });
      expect(r, status).toEqual({ ok: false, code: "INVALID_STATUS" });
    }
  });

  it("sıfır valize indirmeyi reddeder", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking());
    expect(
      await applyBagRevision("b1", PARTNER, {
        counts: { bagCountS: 0, bagCountM: 0, bagCountXl: 0 },
      }),
    ).toEqual({ ok: false, code: "INVALID_COUNTS" });
  });

  it("rezervasyonun KENDİ kural kopyası varsa bugünküleri kullanmaz", async () => {
    // P0-4 ile ayni sinif: admin bir carpani degistirdikten sonra yapilan bir
    // revizyon, rezervasyonun TAMAMINI bugunku fiyata cevirmemeli.
    mockPrisma.booking.findUnique.mockResolvedValue(
      // Gecerli bir anlik kopya `v` ve `at` tasir — `readPricingSnapshot` bunlari arar.
      booking({ pricingSnapshot: { ...RULES, insuranceFeeTry: 999, v: 1, at: "2026-08-01T00:00:00.000Z" } }),
    );

    await applyBagRevision("b1", PARTNER, {
      counts: { bagCountS: 1, bagCountM: 1, bagCountXl: 0 },
    });

    expect(mockGetPricingRules).not.toHaveBeenCalled();
    expect(mockEvents.record.mock.calls[0][0].metadata.rulesSource).toBe("booking_snapshot");
  });

  it("denetim izine kim, ne kadar ve tahsil edilip edilmediği yazılır", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking());

    await applyBagRevision("b1", PARTNER, {
      counts: { bagCountS: 2, bagCountM: 1, bagCountXl: 0 },
      source: "mobile",
    });

    const meta = mockEvents.record.mock.calls[0][0];
    expect(meta.event).toBe("BAGS_MODIFIED");
    expect(meta.actorId).toBe("owner-1");
    expect(meta.metadata.source).toBe("mobile");
    // Fark HENUZ tahsil edilmedi (P1-21); operasyon bunu takip eder.
    expect(meta.metadata.settled).toBe(false);
    expect(typeof meta.metadata.delta).toBe("number");
  });

  it("başka bir esnafın rezervasyonuna dokunamaz", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(
      booking({ shop: { ownerId: "baska", pricePerDay: 50 } }),
    );
    expect(
      await applyBagRevision("b1", PARTNER, {
        counts: { bagCountS: 1, bagCountM: 1, bagCountXl: 0 },
      }),
    ).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mockPrisma.booking.update).not.toHaveBeenCalled();
  });
});

describe("proposeBagRevision", () => {
  it("rezervasyona DOKUNMAZ, yalnızca öneri kaydı yazar", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking());

    const result = await proposeBagRevision(
      "b1",
      { bagCountS: 3, bagCountM: 0, bagCountXl: 0 },
      PARTNER,
    );

    expect(result.ok).toBe(true);
    const data = mockPrisma.booking.update.mock.calls[0][0].data;
    expect(Object.keys(data)).toEqual(["pendingBagRevision"]);
    expect(data.pendingBagRevision).toMatchObject({ bagCountS: 3 });
  });

  it("ek tutarı SUNUCUDA hesaplar — istemciden alınmaz (P1-8)", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking());

    const result = await proposeBagRevision(
      "b1",
      { bagCountS: 5, bagCountM: 5, bagCountXl: 5 },
      PARTNER,
    );

    expect(result.ok && typeof result.extraAmount === "number").toBe(true);
    const written = mockPrisma.booking.update.mock.calls[0][0].data.pendingBagRevision;
    expect(written.extraAmount).toBeGreaterThan(0);
    expect(written.previousTotal).toBeLessThan(written.newTotal);
  });
});

describe("clearBagRevision", () => {
  it("yalnızca öneriyi siler", async () => {
    mockPrisma.booking.findUnique.mockResolvedValue(booking());
    expect(await clearBagRevision("b1", PARTNER)).toEqual({ ok: true });
    expect(Object.keys(mockPrisma.booking.update.mock.calls[0][0].data)).toEqual([
      "pendingBagRevision",
    ]);
  });
});

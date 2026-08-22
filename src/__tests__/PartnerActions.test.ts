import { describe, it, expect, vi, beforeEach } from "vitest";
import { setPendingBagRevisionAction, updatePartnerPhoneAction } from "../actions/partner";

const { mockPrisma, mockAuth } = vi.hoisted(() => {
  return {
    mockPrisma: {
      user: {
        update: vi.fn(),
      },
      booking: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
    mockAuth: vi.fn(),
  };
});

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));
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
}));
vi.mock("@/services/BookingEventService", () => ({
  bookingEventService: { record: vi.fn().mockResolvedValue(undefined) },
}));

/** Fiyati hesaplanabilir bir rezervasyon: 1 gunluk, 100 TRY/gun. */
const DAY = 24 * 60 * 60 * 1000;
function paidBooking(over: Record<string, unknown> = {}) {
  return {
    id: "b1",
    status: "PAID",
    shop: { ownerId: "partner-1", pricePerDay: 100 },
    bagCountS: 0,
    bagCountM: 1,
    bagCountXl: 0,
    totalPrice: 100,
    checkInTime: new Date("2026-08-22T10:00:00Z"),
    checkOutTime: new Date("2026-08-22T10:00:00Z").getTime() + DAY
      ? new Date(new Date("2026-08-22T10:00:00Z").getTime() + DAY)
      : new Date(),
    pricingSnapshot: null,
    ...over,
  };
}

describe("Partner Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "partner-1", role: "PARTNER" } });
  });

  describe("setPendingBagRevisionAction", () => {
    it("should fail if unauthorized", async () => {
      mockAuth.mockResolvedValue({ user: { id: "guest-1", role: "GUEST" } });
      const result = await setPendingBagRevisionAction({});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.notAuthorizedPartner");
    });

    it("should validate input schema (Zod)", async () => {
      const result = await setPendingBagRevisionAction({
        bookingId: "invalid-uuid",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.invalidData");
    });

    it("should fail if booking belongs to another shop", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        shop: { ownerId: "other-partner" },
      });

      const result = await setPendingBagRevisionAction({
        bookingId: "550e8400-e29b-41d4-a716-446655440000",
        bagCountS: 1,
        bagCountM: 1,
        bagCountXl: 0,
        extraAmount: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.unauthorized");
    });

    it("should fail if booking status is not PAID or CHECKED_IN", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "WAITING_APPROVAL",
        shop: { ownerId: "partner-1" },
      });

      const result = await setPendingBagRevisionAction({
        bookingId: "550e8400-e29b-41d4-a716-446655440000",
        bagCountS: 1,
        bagCountM: 1,
        bagCountXl: 0,
        extraAmount: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.invalidData");
    });

    it("should update booking with valid data", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(paidBooking());

      const result = await setPendingBagRevisionAction({
        bookingId: "550e8400-e29b-41d4-a716-446655440000",
        bagCountS: 2,
        bagCountM: 1,
        bagCountXl: 0,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          pendingBagRevision: expect.objectContaining({
            bagCountS: 2,
            // 100 TRY/gun, 1 gun. Once M1 -> 100, sonra S2 M1 -> 100*(0.8*2+1) = 260.
            // Bu deger SUNUCUDA hesaplaniyor.
            //
            // NOT: bu beklenti eskiden `extraAmount: 50` idi -- yani testin kendisi
            // istemciden gelen tutarin deftere yazilmasini DOGRULANMIS DAVRANIS
            // olarak kodluyordu. Aciklik testle birlikte geldigi icin kimse fark
            // etmedi (P1-8).
            extraAmount: 160,
          })
        })
      }));
    });

    /**
     * P1-8: `extraAmount` eskiden ISTEMCIDEN aliniyordu, yani esnaf misafire
     * gosterilecek ek ucreti kendisi yazabiliyordu ve sunucu hic dogrulamiyordu.
     */
    it("istemciden gelen extraAmount YOK SAYILIR, fark sunucuda hesaplanir", async () => {
      // 1 gunluk, 100 TRY/gun. Once: M1 -> 100. Sonra: S2 M1 -> 100*(0.8*2+1) = 260.
      // Gercek fark 160; istemci 5 gondermis olsa bile o yok sayilmali.
      mockPrisma.booking.findUnique.mockResolvedValue(paidBooking());

      const result = await setPendingBagRevisionAction({
        bookingId: "550e8400-e29b-41d4-a716-446655440000",
        bagCountS: 2,
        bagCountM: 1,
        bagCountXl: 0,
        extraAmount: 5, // istemcinin uydurdugu tutar
      } as never);

      expect(result.success).toBe(true);
      const written = mockPrisma.booking.update.mock.calls[0][0].data.pendingBagRevision;
      expect(written.extraAmount).not.toBe(5);
      expect(written.extraAmount).toBe(160);
      expect(written.previousTotal).toBe(100);
      expect(written.newTotal).toBe(260);
    });

    it("valiz azaldiginda fark NEGATIF olur", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(
        paidBooking({ bagCountS: 2, bagCountM: 1, bagCountXl: 0 }),
      );

      await setPendingBagRevisionAction({
        bookingId: "550e8400-e29b-41d4-a716-446655440000",
        bagCountS: 0,
        bagCountM: 1,
        bagCountXl: 0,
      });

      const written = mockPrisma.booking.update.mock.calls[0][0].data.pendingBagRevision;
      expect(written.extraAmount).toBe(-160);
    });

    it("rezervasyonun kendi fiyat kurallari varsa ONLAR kullanilir", async () => {
      // Anlik kopyada XL carpani 3.0; bugunku ayarda 1.5. Kopya kazanmali.
      mockPrisma.booking.findUnique.mockResolvedValue(
        paidBooking({
          pricingSnapshot: {
            v: 1,
            at: "2026-06-01T00:00:00.000Z",
            maxStayDays: 30,
            maxBagsPerSlot: 50,
            insuranceFeeTry: 0,
            earlyRefundRatio: 1,
            cancelFixedFeeTry: 0,
            latePickupFeeTry: 0,
            latePickupGraceMin: 15,
            defaultShopCapacity: 10,
            defaultPricePerDay: 50,
            bagMultipliers: { S: 0.8, M: 1, XL: 3.0 },
            platformHolidayDates: [],
          },
        }),
      );

      await setPendingBagRevisionAction({
        bookingId: "550e8400-e29b-41d4-a716-446655440000",
        bagCountS: 0,
        bagCountM: 1,
        bagCountXl: 1,
      });

      const written = mockPrisma.booking.update.mock.calls[0][0].data.pendingBagRevision;
      // M1 + XL1 = 100*(1 + 3.0) = 400. Bugunku kurallarla 250 olurdu.
      expect(written.newTotal).toBe(400);
      expect(written.rulesSource).toBe("booking_snapshot");
    });

  });

  describe("updatePartnerPhoneAction", () => {
    it("should normalize and update phone", async () => {
      const result = await updatePartnerPhoneAction("0555 123 45 67");

      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "partner-1" },
        data: { phone: "5551234567" },
      });
    });

    it("should return error for invalid phone", async () => {
      const result = await updatePartnerPhoneAction("invalid");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.invalidTrPhone");
    });

    it("should handle unique constraint violations (P2002)", async () => {
      mockPrisma.user.update.mockRejectedValue({ code: "P2002" });
      
      const result = await updatePartnerPhoneAction("0555 555 55 55");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.phoneAlreadyRegistered");
    });
  });
});

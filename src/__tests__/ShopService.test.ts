import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShopService } from "../services/ShopService";

const { mockPrisma, mockGetActiveShops } = vi.hoisted(() => {
  return {
    mockPrisma: {
      shop: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      booking: {
        findMany: vi.fn(),
        groupBy: vi.fn(),
        count: vi.fn(),
      },
      user: {
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((fn) => fn(mockPrisma)),
    },
    mockGetActiveShops: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  default: mockPrisma,
}));

vi.mock("@/lib/shop-distance-postgis", () => ({
  getActiveShopsOrderedByDistanceKm: mockGetActiveShops,
}));

vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    sendEmail: vi.fn().mockResolvedValue(true),
    sendSms: vi.fn().mockResolvedValue(true),
  },
}));

describe("ShopService", () => {
  const service = new ShopService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findShopsForSearch", () => {
    it("should filter out shops that are closed at check-in time", async () => {
      const checkIn = new Date("2024-01-01T22:00:00"); // 22:00
      const checkOut = new Date("2024-01-02T10:00:00");

      mockGetActiveShops.mockResolvedValue([
        {
          shop: {
            id: "shop-closed",
            name: "Closed Shop",
            openingTime: "08:00",
            closingTime: "20:00",
            capacity: 10,
            open247: false,
            isActive: true,
          },
          distanceKm: 1,
        },
      ]);
      mockPrisma.booking.groupBy.mockResolvedValue([]);

      const hits = await service.findShopsForSearch({
        centerLat: 41,
        centerLng: 29,
        radiusKm: 5,
        checkIn,
        checkOut,
        requestedBags: 1,
      });

      expect(hits).toHaveLength(0);
    });

    it("should include shops that are open 24/7", async () => {
      const checkIn = new Date("2024-01-01T22:00:00");
      const checkOut = new Date("2024-01-02T10:00:00");

      mockGetActiveShops.mockResolvedValue([
        {
          shop: {
            id: "shop-247",
            name: "Always Open",
            capacity: 10,
            open247: true,
            isActive: true,
          },
          distanceKm: 1,
        },
      ]);
      mockPrisma.booking.groupBy.mockResolvedValue([]);

      const hits = await service.findShopsForSearch({
        centerLat: 41,
        centerLng: 29,
        radiusKm: 5,
        checkIn,
        checkOut,
        requestedBags: 1,
      });

      expect(hits).toHaveLength(1);
      expect(hits[0].id).toBe("shop-247");
    });

    it("should filter out shops with insufficient capacity", async () => {
      const checkIn = new Date("2024-01-01T10:00:00");
      const checkOut = new Date("2024-01-01T18:00:00");

      mockGetActiveShops.mockResolvedValue([
        {
          shop: {
            id: "shop-full",
            capacity: 5,
            open247: true,
            isActive: true,
          },
          distanceKm: 1,
        },
      ]);

      // Overlapping bookings use 4 slots
      mockPrisma.booking.groupBy.mockResolvedValue([
        {
          shopId: "shop-full",
          _sum: { bagCountS: 2, bagCountM: 2, bagCountXl: 0 },
        },
      ]);

      // Requesting 2 more bags -> Total 6 > Capacity 5
      const hits = await service.findShopsForSearch({
        centerLat: 41,
        centerLng: 29,
        radiusKm: 5,
        checkIn,
        checkOut,
        requestedBags: 2,
      });

      expect(hits).toHaveLength(0);
    });
  });

  describe("approveShop", () => {
    it("should update shop status and verify owner email", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue({
        id: "shop-1",
        ownerId: "owner-1",
        name: "Test Shop",
        /*
          KOORDINAT SART (2026-09-02): arama tamamen mesafe uzerinden calisiyor,
          o yuzden koordinatsiz dukkan artik onaylanmiyor. Mock'ta da olmali --
          yoksa test, gercekte olmayan bir durumu (konumsuz onaylanmis dukkan)
          dogruluyor olurdu.
        */
        latitude: 41.0256,
        longitude: 28.9741,
        owner: { email: "owner@test.com", name: "Owner Name" },
      });

      const sonuc = await service.approveShop("shop-1");

      expect(sonuc).toEqual({ ok: true });
      expect(mockPrisma.shop.update).toHaveBeenCalledWith({
        where: { id: "shop-1" },
        data: { isActive: true },
      });
      expect(mockPrisma.user.updateMany).toHaveBeenCalled();
    });
  });

  describe("rejectPendingShop", () => {
    it("should return an Errors.x key when the shop does not exist", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue(null);

      const result = await service.rejectPendingShop("missing-shop");

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Errors.shopNotFound");
    });

    it("should not reject an already-approved shop", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue({ id: "shop-1", isActive: true });

      const result = await service.rejectPendingShop("shop-1");

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Errors.shopAlreadyApproved");
      expect(mockPrisma.shop.delete).not.toHaveBeenCalled();
    });

    it("should not delete shop if it has existing bookings", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue({ id: "shop-1", isActive: false });
      mockPrisma.booking.count.mockResolvedValue(1);

      const result = await service.rejectPendingShop("shop-1");

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Errors.shopHasBookings");
      expect(mockPrisma.shop.delete).not.toHaveBeenCalled();
    });

    it("should delete shop if no bookings exist", async () => {
      mockPrisma.shop.findUnique.mockResolvedValue({ id: "shop-1", isActive: false });
      mockPrisma.booking.count.mockResolvedValue(0);

      const result = await service.rejectPendingShop("shop-1");

      expect(result.ok).toBe(true);
      expect(mockPrisma.shop.delete).toHaveBeenCalledWith({ where: { id: "shop-1" } });
    });
  });
});

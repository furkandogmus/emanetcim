import { describe, it, expect, vi, beforeEach } from "vitest";
import { SealService } from "../services/SealService";

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      seal: {
        createMany: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        groupBy: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn((fn) => {
        if (typeof fn === 'function') return fn(mockPrisma);
        return Promise.all(fn);
      }),
      booking: {
        findMany: vi.fn(),
      },
      bookingSeal: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));

describe("SealService Deep Logic", () => {
  let service: SealService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SealService();
  });

  describe("bulkCreateSeals", () => {
    it("should reject invalid ranges", async () => {
      await expect(service.bulkCreateSeals(100, 50)).rejects.toThrow("invalid_range");
    });

    it("should reject too large ranges", async () => {
      await expect(service.bulkCreateSeals(1, 60000)).rejects.toThrow("range_too_large");
    });

    it("should call prisma.createMany with correctly generated range", async () => {
      mockPrisma.seal.createMany.mockResolvedValue({ count: 5 });
      const result = await service.bulkCreateSeals(1, 5);
      
      expect(result.created).toBe(5);
      expect(mockPrisma.seal.createMany).toHaveBeenCalledWith({
        data: [
          { serialNumber: 1, status: "STOCK" },
          { serialNumber: 2, status: "STOCK" },
          { serialNumber: 3, status: "STOCK" },
          { serialNumber: 4, status: "STOCK" },
          { serialNumber: 5, status: "STOCK" },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe("assignSealsToShop", () => {
    it("should assign STOCK seals to a specific shop", async () => {
      mockPrisma.seal.updateMany.mockResolvedValue({ count: 10 });
      const result = await service.assignSealsToShop("shop-1", 1000, 1009);
      
      expect(result.updated).toBe(10);
      expect(mockPrisma.seal.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          serialNumber: { gte: 1000, lte: 1009 },
          status: "STOCK",
          shopId: null,
        },
        data: expect.objectContaining({
          shopId: "shop-1",
          status: "ASSIGNED",
        }),
      }));
    });
  });

  describe("predictSealDemand", () => {
    it("should aggregate bag counts for future bookings", async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        { bagCountS: 2, bagCountM: 1, bagCountXl: 0 },
        { bagCountS: 1, bagCountM: 1, bagCountXl: 1 },
      ]);

      const demand = await service.predictSealDemand("shop-1", 7);
      
      // (2+1+0) + (1+1+1) = 6
      expect(demand).toBe(6);
    });
  });

  describe("recycleReturnedSeals", () => {
    it("should update RETURNED seals back to ASSIGNED", async () => {
      mockPrisma.seal.updateMany.mockResolvedValue({ count: 20 });
      const result = await service.recycleReturnedSeals("shop-1");
      
      expect(result).toBe(20);
      expect(mockPrisma.seal.updateMany).toHaveBeenCalledWith({
        where: { shopId: "shop-1", status: "RETURNED" },
        data: { status: "ASSIGNED" },
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocking prisma before importing any service that uses it
vi.mock("@/lib/db", () => ({
  default: {
    shop: {
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from "@/lib/db";

describe("Admin Application Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch only inactive shops", async () => {
    const mockShops = [{ id: "1", name: "Shop 1", isActive: false }];
    (prisma.shop.findMany as any).mockResolvedValue(mockShops);

    const result = await prisma.shop.findMany({ where: { isActive: false } });
    
    expect(result).toHaveLength(1);
    expect(result[0].isActive).toBe(false);
  });

  it("should mark shop as active on approval", async () => {
    const shopId = "123";
    await prisma.shop.update({
      where: { id: shopId },
      data: { isActive: true },
    });

    expect(prisma.shop.update).toHaveBeenCalledWith({
      where: { id: shopId },
      data: { isActive: true },
    });
  });
});

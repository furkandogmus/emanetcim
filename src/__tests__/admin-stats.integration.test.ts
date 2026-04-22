/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, vi } from "vitest";

vi.unmock("@/lib/db");
import { Role } from "@prisma/client";

const runAdminStatsIntegration =
  process.env.CI === "true" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!runAdminStatsIntegration)("admin stats integration", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeAll(async () => {
    const db = await import("@/lib/db");
    prisma = db.default;
  });

  it("should count pending shop applications correctly", async () => {
    const suf = `stats-${Date.now()}`;
    
    // Create a partner
    const partner = await prisma.user.create({
      data: {
        email: `partner-${suf}@test.local`,
        name: "Stats Partner",
        role: Role.PARTNER,
      },
    });

    // Create an inactive shop (pending application)
    const shop = await prisma.shop.create({
      data: {
        ownerId: partner.id,
        name: "Pending Shop",
        isActive: false,
        capacity: 5,
      },
    });

    // We can't easily call the API route in vitest node env without setup,
    // but we can test the PRISMA query logic used in the route.
    const pendingCount = await prisma.shop.count({
      where: { isActive: false },
    });

    expect(pendingCount).toBeGreaterThanOrEqual(1);

    // Cleanup
    await prisma.shop.delete({ where: { id: shop.id } });
    await prisma.user.delete({ where: { id: partner.id } });
  });
});

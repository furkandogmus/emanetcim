/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Role, BookingStatus, PaymentStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

/** Yalnızca GitHub Actions (Postgres servis) üzerinde çalışır; yerel `npm test` gürültüsüz kalır. */
const runFinanceIntegration =
  process.env.CI === "true" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!runFinanceIntegration)("finance reconcile integration", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test harness; Prisma adapter client
  let prisma: any;
  let paymentService: typeof import("@/services/PaymentService")["paymentService"];

  const ids: {
    guestId?: string;
    partnerId?: string;
    shopId?: string;
    bookingId?: string;
  } = {};

  beforeAll(async () => {
    const db = await import("@/lib/db");
    const ps = await import("@/services/PaymentService");
    prisma = db.default;
    paymentService = ps.paymentService;
  });

  afterAll(async () => {
    if (!ids.bookingId || !ids.shopId) return;
    try {
      await prisma.paymentLog.deleteMany({ where: { bookingId: ids.bookingId } });
      await prisma.booking.delete({ where: { id: ids.bookingId } });
      await prisma.shop.delete({ where: { id: ids.shopId } });
      if (ids.guestId) await prisma.user.delete({ where: { id: ids.guestId } });
      if (ids.partnerId) await prisma.user.delete({ where: { id: ids.partnerId } });
    } catch {
      // best-effort cleanup
    }
  });

  it("reconcile integration: PENDING booking + SUCCESS PaymentLog → PAID", async () => {
    const suf = `reconcile-${Date.now()}`;
    const guestEmail = `guest-${suf}@test.local`;
    const partnerEmail = `partner-${suf}@test.local`;

    const guest = await prisma.user.create({
      data: {
        email: guestEmail,
        name: "Integration Guest",
        role: Role.GUEST,
      },
    });
    ids.guestId = guest.id;

    const partner = await prisma.user.create({
      data: {
        email: partnerEmail,
        name: "Integration Partner",
        role: Role.PARTNER,
      },
    });
    ids.partnerId = partner.id;

    const shop = await prisma.shop.create({
      data: {
        ownerId: partner.id,
        name: "Integration Shop",
        isActive: true,
        capacity: 10,
      },
    });
    ids.shopId = shop.id;

    const checkIn = new Date();
    const checkOut = new Date(checkIn.getTime() + 86_400_000);

    const booking = await prisma.booking.create({
      data: {
        guestId: guest.id,
        shopId: shop.id,
        status: BookingStatus.PENDING,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        totalPrice: new Prisma.Decimal(100),
      },
    });
    ids.bookingId = booking.id;

    await prisma.paymentLog.create({
      data: {
        bookingId: booking.id,
        amount: new Prisma.Decimal(100),
        status: PaymentStatus.SUCCESS,
      },
    });

    const result = await paymentService.reconcileStalePaymentBookings();
    expect(result.fixed).toBeGreaterThanOrEqual(1);
    expect(result.bookingIds).toContain(booking.id);

    const updated = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(updated.status).toBe(BookingStatus.PAID);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDisputeAction, updateDisputeStatusAction } from "../actions/dispute";

const { mockPrisma, mockAuth } = vi.hoisted(() => {
  return {
    mockPrisma: {
      booking: {
        findUnique: vi.fn(),
      },
      dispute: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
    mockAuth: vi.fn(),
  };
});

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyAdminsForDispute: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock("@/lib/revalidate-locales", () => ({ revalidatePathAllLocales: vi.fn() }));

describe("Dispute Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "guest-1", role: "GUEST" } });
  });

  describe("createDisputeAction", () => {
    it("should fail if unauthorized (not the booking owner)", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({ guestId: "other-guest" });
      const result = await createDisputeAction({
        bookingId: "b1",
        reason: "DAMAGE",
        description: "Broken bag",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.unauthorized");
    });

    it("should fail if booking status is not CHECKED_IN or CHECKED_OUT", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        guestId: "guest-1",
        status: "PAID", // Cannot dispute before check-in or after cancel
      });

      const result = await createDisputeAction({
        bookingId: "b1",
        reason: "DAMAGE",
        description: "Broken bag",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.disputeNotReady");
    });

    it("should fail if dispute already exists", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        guestId: "guest-1",
        status: "CHECKED_IN",
      });
      mockPrisma.dispute.findUnique.mockResolvedValue({ id: "d1" });

      const result = await createDisputeAction({
        bookingId: "b1",
        reason: "DAMAGE",
        description: "Broken bag",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.duplicateDispute");
    });

    it("should create dispute on valid request", async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        guestId: "guest-1",
        status: "CHECKED_IN",
      });
      mockPrisma.dispute.findUnique.mockResolvedValue(null);
      /*
        Prisma `create` HER ZAMAN olusturulan satiri doner; mock bunu
        yapmiyordu ve `undefined` donuyordu. Govde `DisputeService`e tasinip
        olusan kaydin `id`si dondurulmeye baslayinca ortaya cikti -- yani mock
        gercekci degildi, davranis dogruydu.
      */
      mockPrisma.dispute.create.mockResolvedValue({ id: "d-new" });

      const result = await createDisputeAction({
        bookingId: "b1",
        reason: "DAMAGE",
        description: "Broken bag",
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.dispute.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: "b1",
          reason: "DAMAGE",
        }),
      });
    });
  });

  describe("updateDisputeStatusAction", () => {
    /**
     * Yetki kapisi 2026-08-25'te `src/lib/action-auth.ts`'e tasindi ve iki sey
     * degisti:
     *
     *   1. Oturum fixture'lari `id` TASIYOR. Gercek oturum her zaman tasir
     *      (`src/types/next-auth.d.ts`); id'siz taklit, kapinin "giris yapmis mi"
     *      dalini yanlislikla tetikliyordu.
     *   2. Giris yapmis ama YETKISIZ kullanici artik `notAuthorizedAdmin` aliyor,
     *      `unauthorized` degil — kullaniciya neyin eksik oldugunu soyleyen anahtar.
     */
    it("should block non-admins", async () => {
      mockAuth.mockResolvedValue({ user: { id: "partner-1", role: "PARTNER" } });
      const result = await updateDisputeStatusAction("d1", "RESOLVED");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.notAuthorizedAdmin");
    });

    it("giriş yapmamış kullanıcıya giriş yapmasını söyler", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await updateDisputeStatusAction("d1", "RESOLVED");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.authRequired");
    });

    it("should fail with invalid status (zod enum check)", async () => {
      mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      const result = await updateDisputeStatusAction("d1", "INVALID_STATUS");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errors.invalidData");
    });

    it("should update status for admins", async () => {
      mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
      const result = await updateDisputeStatusAction("d1", "RESOLVED", "Log note");
      expect(result.success).toBe(true);
      expect(mockPrisma.dispute.update).toHaveBeenCalledWith({
        where: { id: "d1" },
        data: { status: "RESOLVED", adminNote: "Log note" },
      });
    });
  });
});

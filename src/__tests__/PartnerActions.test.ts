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
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: "b1",
        status: "PAID",
        shop: { ownerId: "partner-1" },
      });

      const result = await setPendingBagRevisionAction({
        bookingId: "550e8400-e29b-41d4-a716-446655440000",
        bagCountS: 2,
        bagCountM: 1,
        bagCountXl: 0,
        extraAmount: 50,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          pendingBagRevision: expect.objectContaining({
            bagCountS: 2,
            extraAmount: 50,
          })
        })
      }));
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

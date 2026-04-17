import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationService } from "../services/NotificationService";

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      notificationLog: {
        create: vi.fn(),
      },
      pushSubscription: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      bookingSeal: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/db", () => ({
  default: mockPrisma,
}));

vi.mock("@/lib/netgsm", () => ({
  isNetgsmConfigured: vi.fn().mockReturnValue(true),
  normalizeTrGsm10: vi.fn((n) => (n?.length === 10 ? n : null)),
  parseAdminGsmNumbers: vi.fn().mockReturnValue(["5555555555"]),
  sendNetgsmRestSms: vi.fn().mockResolvedValue({ ok: true, jobId: "123" }),
}));

// Mock global fetch
global.fetch = vi.fn();

describe("NotificationService", () => {
  const service = new NotificationService();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test_key";
    process.env.GUEST_SMS_BOOKING_NOTIFICATIONS = "true";
  });

  describe("sendEmail", () => {
    it("should call resend API and log the notification", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await service.sendEmail("test@example.com", "Subject", "Body");

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("test@example.com"),
        })
      );
      expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "EMAIL",
            status: "SENT",
          }),
        })
      );
    });

    it("should return false and log FAILED if fetch fails", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Error message"),
      });

      const result = await service.sendEmail("test@example.com", "Subject", "Body");

      expect(result).toBe(false);
      expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "FAILED",
          }),
        })
      );
    });
  });

  describe("sendSms", () => {
    it("should call sendNetgsmRestSms and log it", async () => {
      const result = await service.sendSms("5555555555", "Test Message");

      expect(result).toBe(true);
      expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "SMS",
            status: "SENT",
          }),
        })
      );
    });

    it("should fail if number is invalid", async () => {
      const result = await service.sendSms("invalid", "Test Message");

      expect(result).toBe(false);
      expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "FAILED",
            error: "invalid_gsm",
          }),
        })
      );
    });
  });

  describe("notifyCheckIn", () => {
    it("should include seal numbers in the email if they exist", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });
      mockPrisma.bookingSeal.findMany.mockResolvedValue([
        { sealNumber: 1234, bagIndex: 1, bagSize: "M" },
      ]);

      await service.notifyCheckIn("test@example.com", "booking-1", "tr");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("mühür #1234"),
        })
      );
    });
  });
});

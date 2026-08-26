/* eslint-disable @typescript-eslint/no-explicit-any */
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
      booking: {
        findUnique: vi.fn(),
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

    /**
     * NEDEN (2026-08-25): `sendEmail` partner check-in/check-out akışlarında
     * DOĞRUDAN `await`leniyor. Resend hiç yanıt vermezse (asılı kalırsa) zaman
     * aşımı olmadan istek süresiz askıda kalırdı.
     */
    it("her istek bir iptal sinyaliyle çıkar — asılı kalan istek soket sızdırmaz", async () => {
      let seenSignal: unknown;
      (global.fetch as any).mockImplementation(
        async (_url: string, init: RequestInit) => {
          seenSignal = init.signal;
          return { ok: true, text: async () => "" };
        },
      );

      await service.sendEmail("test@example.com", "Subject", "Body");

      expect(seenSignal).toBeInstanceOf(AbortSignal);
    });

    it("Resend hiç yanıt vermezse (zaman aşımı) gönderim FAILED olarak kaydedilir", async () => {
      /*
        Süre dolduğunda ÇALIŞMA ZAMANININ ürettiği hata bu: `fetchWithTimeout`
        isteği `AbortSignal.timeout` ile sonlandırıp etiketli hataya normalize
        eder. Sahte zamanlayıcıyla sürülemez — `AbortSignal.timeout` Node'un iç
        zamanlayıcısını kullanır ve `vi.advanceTimersByTime` onu tetiklemez
        (ölçüldü). Zaman aşımının KENDİSİ `src/lib/async-timeout.test.ts`'te;
        burada ölçülen şey, o hata geldiğinde çağıranın çökmeyip `false`
        döndürmesi ve girişimin deftere yazılması.
      */
      (global.fetch as any).mockRejectedValue(
        new Error("notification_email_send_timeout_after_8000ms"),
      );

      await expect(
        service.sendEmail("test@example.com", "Subject", "Body"),
      ).resolves.toBe(false);

      expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "EMAIL", status: "FAILED" }),
        }),
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

    /**
     * NEDEN (2026-08-25'te ölçüldü): `de`/`fr`/`ja`/`fa` misafiri, üstteki
     * cümle çevrilse bile mühür listesi hep İngilizce ("seal #1234") kalsaydı,
     * yarı Fransızca yarı İngilizce bir e-posta alırdı.
     */
    it("should translate the seal list too, not just the greeting (fr)", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });
      mockPrisma.bookingSeal.findMany.mockResolvedValue([
        { sealNumber: 1234, bagIndex: 1, bagSize: "M" },
      ]);

      await service.notifyCheckIn("test@example.com", "booking-1", "fr");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("scellé #1234"),
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.not.stringContaining("seal #1234"),
        })
      );
    });
  });

  describe("notifyCheckOut — 6 dil", () => {
    it.each([
      ["de", "Gute Reise"],
      ["fr", "Bon voyage"],
      ["ja", "良い旅を"],
      ["fa", "سفر خوبی"],
    ])("should not fall back to Turkish for %s", async (locale, expectedPhrase) => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      await service.notifyCheckOut("test@example.com", "booking-1", locale);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: expect.stringContaining(expectedPhrase) }),
      );
    });
  });

  describe("notifyBookingSuccess — 6 dil", () => {
    /**
     * NEDEN (2026-08-25'te ölçüldü): içerik nesnesi yalnızca `tr`/`en` içeriyordu;
     * diğer 4 dil `?? fallback`'e düşüp HTML'siz, tek satırlık bir Türkçe e-posta
     * alıyordu — uygulamanın geri kalanı tam çevrilmişken rezervasyon onay
     * e-postası (misafirin sakladığı belge) 4 dilde bozuk geliyordu.
     */
    it.each([
      ["de", "Reservierung wurde erstellt"],
      ["fr", "Réservation confirmée"],
      ["ja", "ご予約が完了しました"],
      ["fa", "رزرو شما ثبت شد"],
    ])("should not fall back to Turkish for %s", async (locale, expectedPhrase) => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      await service.notifyBookingSuccess("test@example.com", "booking-1", 1520, locale);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: expect.stringContaining(expectedPhrase) }),
      );
    });
  });

  describe("notifyBookingApproved — 6 dil", () => {
    it.each([
      ["de", "wurde angenommen"],
      ["fr", "a été acceptée"],
      ["ja", "承認されました"],
      ["fa", "تأیید شد"],
    ])("should not fall back to Turkish for %s", async (locale, expectedPhrase) => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      await service.notifyBookingApproved("test@example.com", "booking-1", "Test Shop", locale);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: expect.stringContaining(expectedPhrase) }),
      );
    });
  });

  describe("notifyBookingCancelled — 6 dil", () => {
    it.each([
      ["de", "abgelehnt"],
      ["fr", "refusée"],
      ["ja", "却下されました"],
      ["fa", "رد شد"],
    ])("should not fall back to Turkish for %s", async (locale, expectedPhrase) => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      await service.notifyBookingCancelled("test@example.com", "booking-1", "Test Shop", locale);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: expect.stringContaining(expectedPhrase) }),
      );
    });
  });

  describe("notifyPartnerAndAdminsForNewPaidBooking", () => {
    it("should send email to partner and admins", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });
      mockPrisma.booking.findUnique.mockResolvedValue({
        status: "WAITING_APPROVAL",
        shop: {
          owner: {
            email: "partner@example.com",
          },
        },
      });
      process.env.ADMIN_EMAILS = "admin1@example.com,admin2@example.com";

      await service.notifyPartnerAndAdminsForNewPaidBooking({
        bookingId: "booking-1",
        shopName: "Test Shop",
        partnerPhone: "5555555555",
        totalPrice: 100,
      });

      // Should call fetch for partner email and both admin emails
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("notifyAdminsForDispute", () => {
    it("should send email to admins", async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });
      process.env.ADMIN_EMAILS = "admin1@example.com,admin2@example.com";

      await service.notifyAdminsForDispute({
        bookingId: "booking-1",
        reason: "Baggage lost",
      });

      // Should call fetch for both admin emails
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Rezervasyon olusturmanin TARIH dogrulamalari — web ve mobilin ORTAK kapisi.
 *
 * NEDEN BU DOSYA VAR (2026-08-25): iki dogrulama iki farkli yerde yasiyordu.
 * Konaklama penceresi `createInitialBooking`'deydi ama TATIL kontrolu YALNIZCA
 * web action'indaydi — yani ayni tarih web'de reddedilirken mobil checkout ucunda
 * KABUL EDILIYORDU. Ustelik penceredeki firlatma tipsiz bir Turkce cumleydi
 * (`new Error('Gecersiz rezervasyon tarihleri.')`) ve mobil uc onu hic
 * yakalamadigi icin gecersiz tarih istemciye HTTP 500 donuyordu.
 *
 * Ikisi de artik serviste ve TIPLI (`BookingRejectedError`); tasiyicilar kodu
 * kendi hata sozlesmesine cevirir.
 */

const { mockPrisma, mockGetPricingRules, RULES } = vi.hoisted(() => {
  const RULES = {
    maxStayDays: 30,
    maxBagsPerSlot: 50,
    insuranceFeeTry: 10,
    earlyRefundRatio: 1,
    cancelFixedFeeTry: 0,
    latePickupFeeTry: 0,
    latePickupGraceMin: 15,
    defaultShopCapacity: 10,
    defaultPricePerDay: 50,
    bagMultipliers: { S: 0.8, M: 1.0, XL: 1.5 },
    platformHolidayDates: [] as string[],
    requireSealsOnCheckIn: false,
  };
  return {
    RULES,
    mockGetPricingRules: vi.fn(),
    mockPrisma: { $transaction: vi.fn() },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
// Odeme kapisi bu dosyanin konusu degil; acik varsayilir.
// Kapali hali PaymentsKillSwitch.test.ts'te sinaniyor.
vi.mock("@/services/PaymentService", () => ({
  paymentService: { isAcceptingNewPayments: vi.fn().mockResolvedValue(true) },
}));
vi.mock("@/lib/platform-settings", () => ({ getPricingRules: mockGetPricingRules }));
vi.mock("@/services/BookingEventService", () => ({
  bookingEventService: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { createInitialBooking } from "@/services/booking/create";
import {
  BookingRejectedError,
  BookingWindowInvalidError,
  BookingHolidayError,
  BookingPaymentsDisabledError,
} from "@/services/booking/errors";
import { paymentService } from "@/services/PaymentService";

const BASE_INPUT = {
  guestId: "g1",
  shopId: "shop-1",
  totalPrice: 100,
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  checkInTime: new Date("2026-09-01T09:00:00Z"),
  checkOutTime: new Date("2026-09-01T18:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPricingRules.mockResolvedValue({ ...RULES, platformHolidayDates: [] });
  /*
    HER TESTTE ACIKCA kuruluyor, `vi.mock` fabrikasindaki degere GUVENILMIYOR:
    `vi.clearAllMocks()` cagri kayitlarini temizler ama IMPLEMENTASYONU birakir.
    Yani bir testin `mockResolvedValue(false)`'u sonraki testlere sizar --
    bu dosyada tam olarak oldu ve alakasiz bir testi kirmizi yakti.
  */
  vi.mocked(paymentService.isAcceptingNewPayments).mockResolvedValue(true);
});

describe("createInitialBooking tarih kapıları", () => {
  it("izin verilen pencereyi aşan aralığı TİPLİ hatayla reddeder", async () => {
    // Ham `Error` degil: cagiran bunu diger hatalardan ayirt edebilmeli, yoksa
    // web `Errors.generic`e duser, mobil ise 500 doner.
    const tooLong = {
      ...BASE_INPUT,
      checkOutTime: new Date("2026-12-01T18:00:00Z"), // 30 gunu asar
    };

    await expect(createInitialBooking(tooLong)).rejects.toBeInstanceOf(
      BookingWindowInvalidError,
    );
    await expect(createInitialBooking(tooLong)).rejects.toMatchObject({
      code: "INVALID_DATES",
    });
    // Kapiyi gecemeyen istek veritabanina HIC dokunmaz.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("platform tatiline denk gelen aralığı reddeder — mobil uç bunu HİÇ yapmıyordu", async () => {
    mockGetPricingRules.mockResolvedValue({
      ...RULES,
      platformHolidayDates: ["2026-09-01"],
    });

    await expect(createInitialBooking(BASE_INPUT)).rejects.toBeInstanceOf(
      BookingHolidayError,
    );
    await expect(createInitialBooking(BASE_INPUT)).rejects.toMatchObject({
      code: "PLATFORM_HOLIDAY",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("ödeme alımı kapalıyken reddeder — web ve mobil AYNI kapıdan geçer", async () => {
    // Kapi serviste, tasiyicida degil. Tasiyiciya yazilsaydi ikisi ayrisirdi:
    // tatil kontrolu 2026-08-25'e kadar tam olarak boyleydi ve ayni tarih
    // web'de reddedilirken mobilde KABUL EDILIYORDU.
    vi.mocked(paymentService.isAcceptingNewPayments).mockResolvedValue(false);

    await expect(createInitialBooking(BASE_INPUT)).rejects.toBeInstanceOf(
      BookingPaymentsDisabledError,
    );
    await expect(createInitialBooking(BASE_INPUT)).rejects.toMatchObject({
      code: "PAYMENTS_DISABLED",
    });
    // Kapiyi gecemeyen istek veritabanina HIC dokunmaz.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("ödeme kapısı TARİH kapılarından SONRA çalışır", async () => {
    // Gecersiz bir tarih, odeme kapali olsa bile INVALID_DATES donmeli:
    // kullaniciya "odeme kapali" demek, duzeltebilecegi gercek sebebi gizler.
    vi.mocked(paymentService.isAcceptingNewPayments).mockResolvedValue(false);

    await expect(
      createInitialBooking({
        ...BASE_INPUT,
        checkOutTime: new Date("2026-12-01T18:00:00Z"),
      }),
    ).rejects.toMatchObject({ code: "INVALID_DATES" });
  });

  it("her iki reddetme de ortak tabandan türer — tek `catch` yeter", async () => {
    // Tasiyicilar `instanceof BookingRejectedError` ile TEK dalda esleyebilsin diye.
    mockGetPricingRules.mockResolvedValue({
      ...RULES,
      platformHolidayDates: ["2026-09-01"],
    });
    await expect(createInitialBooking(BASE_INPUT)).rejects.toBeInstanceOf(
      BookingRejectedError,
    );

    mockGetPricingRules.mockResolvedValue({ ...RULES, platformHolidayDates: [] });
    await expect(
      createInitialBooking({ ...BASE_INPUT, checkOutTime: new Date("2026-12-01T18:00:00Z") }),
    ).rejects.toBeInstanceOf(BookingRejectedError);
  });

  it("geçerli aralık kapılardan geçer", async () => {
    mockPrisma.$transaction.mockResolvedValue({ id: "b1" });
    await expect(createInitialBooking(BASE_INPUT)).resolves.toMatchObject({ id: "b1" });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

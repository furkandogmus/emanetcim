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
    mockPrisma: {
      $transaction: vi.fn(),
      // Prelaunch kapisi rezervasyondan ONCE dukkani okuyor.
      shop: { findUnique: vi.fn() },
    },
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/platform-settings", () => ({ getPricingRules: mockGetPricingRules }));
vi.mock("@/services/BookingEventService", () => ({
  bookingEventService: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { createInitialBooking } from "@/services/booking/create";
import {
  BookingRejectedError,
  BookingWindowInvalidError,
  BookingHolidayError,
  BookingShopPrelaunchError,
} from "@/services/booking/errors";

/*
  TARIHLER SABIT DEGIL, "YARIN"DAN TURETILIYOR.

  Eskiden `2026-09-01T09:00:00Z` yaziliydi ve test TAM O GUN saat 09:05 UTC'de
  kirildi: check-in gecmise dustu, `validateBookingStayWindow` daha ilk kapida
  `BookingWindowInvalidError` firlatti ve tatil ile prelaunch kapilarina hic
  sira gelmedi. Uc test birden, ayni sebeple.

  Bu bir "test eskimesi": urunde hicbir sey bozulmamisti, testin varsayimi
  takvimle birlikte gecersizlesti. Sabit gelecek tarih yazmak sorunu yalnizca
  erteler -- 2027'de ayni sey olur. Tarih artik CALISMA ANINDAN turetiliyor,
  boylece hangi gun kosulursa kosulsun gecerli bir pencere olusuyor.

  `HOLIDAY_DAY` ayni gunden turetiliyor: tatil kontrolu check-in gunuyle
  eslesmezse test yanlis sebepten gecerdi.
*/
const DAY_MS = 24 * 60 * 60 * 1000;
/** Yarin — bugun kosulsa bile check-in her zaman gelecekte. */
const STAY_DAY = new Date(Date.now() + DAY_MS).toISOString().slice(0, 10);
/** 30 gunluk azami konaklamayi kesin asan bir cikis gunu. */
const TOO_FAR_DAY = new Date(Date.now() + 91 * DAY_MS).toISOString().slice(0, 10);

const BASE_INPUT = {
  guestId: "g1",
  shopId: "shop-1",
  totalPrice: 100,
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  checkInTime: new Date(`${STAY_DAY}T09:00:00Z`),
  checkOutTime: new Date(`${STAY_DAY}T18:00:00Z`),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPricingRules.mockResolvedValue({ ...RULES, platformHolidayDates: [] });
  // Varsayilan: normal (prelaunch olmayan) dukkan.
  mockPrisma.shop.findUnique.mockResolvedValue({ isPrelaunch: false });
});

describe("createInitialBooking tarih kapıları", () => {
  it("izin verilen pencereyi aşan aralığı TİPLİ hatayla reddeder", async () => {
    // Ham `Error` degil: cagiran bunu diger hatalardan ayirt edebilmeli, yoksa
    // web `Errors.generic`e duser, mobil ise 500 doner.
    const tooLong = {
      ...BASE_INPUT,
      checkOutTime: new Date(`${TOO_FAR_DAY}T18:00:00Z`), // 30 gunu asar
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
      platformHolidayDates: [STAY_DAY],
    });

    await expect(createInitialBooking(BASE_INPUT)).rejects.toBeInstanceOf(
      BookingHolidayError,
    );
    await expect(createInitialBooking(BASE_INPUT)).rejects.toMatchObject({
      code: "PLATFORM_HOLIDAY",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("talep testi noktasına rezervasyon YAZILMAZ", async () => {
    // Arayuz bu noktalarda rezervasyon dugmesi gostermiyor, ama arayuz TEK
    // basina yeterli degil: mobil uc, dogrudan API cagrisi ya da onbellege
    // alinmis eski bir sayfa ayni yolu deneyebilir. Bedelini valiziyle bos
    // adrese giden misafir oderdi.
    mockPrisma.shop.findUnique.mockResolvedValue({ isPrelaunch: true });

    await expect(createInitialBooking(BASE_INPUT)).rejects.toBeInstanceOf(
      BookingShopPrelaunchError,
    );
    await expect(createInitialBooking(BASE_INPUT)).rejects.toMatchObject({
      code: "SHOP_PRELAUNCH",
    });
    // Kapiyi gecemeyen istek veritabanina HIC yazmaz.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("prelaunch kapısı TARİH kapılarından SONRA çalışır", async () => {
    // Gecersiz tarihli bir istek, nokta prelaunch olsa bile INVALID_DATES
    // donmeli: kullaniciya duzeltebilecegi gercek sebep soylenmeli.
    mockPrisma.shop.findUnique.mockResolvedValue({ isPrelaunch: true });

    await expect(
      createInitialBooking({
        ...BASE_INPUT,
        checkOutTime: new Date(`${TOO_FAR_DAY}T18:00:00Z`),
      }),
    ).rejects.toMatchObject({ code: "INVALID_DATES" });
  });

  it("her iki reddetme de ortak tabandan türer — tek `catch` yeter", async () => {
    // Tasiyicilar `instanceof BookingRejectedError` ile TEK dalda esleyebilsin diye.
    mockGetPricingRules.mockResolvedValue({
      ...RULES,
      platformHolidayDates: [STAY_DAY],
    });
    await expect(createInitialBooking(BASE_INPUT)).rejects.toBeInstanceOf(
      BookingRejectedError,
    );

    mockGetPricingRules.mockResolvedValue({ ...RULES, platformHolidayDates: [] });
  // Varsayilan: normal (prelaunch olmayan) dukkan.
  mockPrisma.shop.findUnique.mockResolvedValue({ isPrelaunch: false });
    await expect(
      createInitialBooking({ ...BASE_INPUT, checkOutTime: new Date(`${TOO_FAR_DAY}T18:00:00Z`) }),
    ).rejects.toBeInstanceOf(BookingRejectedError);
  });

  it("geçerli aralık kapılardan geçer", async () => {
    mockPrisma.$transaction.mockResolvedValue({ id: "b1" });
    await expect(createInitialBooking(BASE_INPUT)).resolves.toMatchObject({ id: "b1" });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

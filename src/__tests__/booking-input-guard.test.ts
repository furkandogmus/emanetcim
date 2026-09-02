import { describe, it, expect, vi } from "vitest";

/**
 * SERVIS GIRDI KAPISI -- TASIYICILARDAN BAGIMSIZ.
 *
 * Gercek veritabaninda olculdu (2026-09-02): servis dogrudan cagrildiginda su
 * girdiler KABUL ediliyordu --
 *
 *     bagCountS: 0     -> KABUL   (hicbir valiz yok, ama kayit ve yer var)
 *     bagCountS: -5    -> KABUL
 *     totalPrice: -500 -> KABUL
 *
 * Tasiyicilar zod ile doguruyor (`z.number().int().min(0).max(20)`), yani
 * bugun bu girdiler disaridan gelemez. Ama CLAUDE.md kurali "yazma islemleri
 * yalnizca `src/services/` uzerinden" diyor; o zaman son savunma hatti da
 * orasi olmali -- yeni bir uc, bir bakim scripti ya da bir admin araci
 * servisi dogrudan cagirdiginda kural yine gecerli olsun.
 *
 * NEGATIF VALIZ en zararlisi: `ReservationSlot.bagCount` negatif yazilir ve o
 * slotun DOLULUK TOPLAMINI DUSURUR -- yani dukkanin kapasitesi sisirilir ve
 * fazla rezervasyon alinir. Negatif tutar ise hakedise ve iadeye negatif taban
 * verir.
 *
 * Tarih sinirlari ZATEN korunuyordu ve ayni olcumde dogrulandi: gecmis tarih,
 * ters tarih, sifir sure ve bir yillik pencere reddediliyor.
 */

vi.mock("@/lib/db", () => ({
  default: {
    // Girdi kapisi Prisma'dan ONCE calisiyor; bu testlerde hicbiri cagrilmamali.
    booking: { create: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/services/NotificationService", () => ({ notificationService: {} }));

const { createInitialBooking } = await import("@/services/booking/create");
const { BookingRejectedError } = await import("@/services/booking/errors");

const temel = {
  shopId: "s1",
  guestId: "g1",
  totalPrice: 100,
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  checkInTime: new Date(Date.now() + 3600_000),
  checkOutTime: new Date(Date.now() + 7200_000),
};

async function reddiYakala(veri: Record<string, unknown>) {
  try {
    await createInitialBooking({ ...temel, ...veri } as never);
    return null;
  } catch (e) {
    return e;
  }
}

describe("rezervasyon girdi kapisi", () => {
  it("SIFIR valiz reddediliyor", async () => {
    const e = await reddiYakala({ bagCountS: 0, bagCountM: 0, bagCountXl: 0 });
    expect(e).toBeInstanceOf(BookingRejectedError);
    expect((e as { code: string }).code).toBe("INVALID_INPUT");
  });

  it("NEGATIF valiz reddediliyor", async () => {
    // Slot dolulugunu DUSURUP kapasiteyi sisirirdi.
    const e = await reddiYakala({ bagCountS: -5 });
    expect((e as { code: string }).code).toBe("INVALID_INPUT");
  });

  it("kesirli valiz reddediliyor", async () => {
    const e = await reddiYakala({ bagCountS: 1.5 });
    expect((e as { code: string }).code).toBe("INVALID_INPUT");
  });

  it("NEGATIF tutar reddediliyor", async () => {
    const e = await reddiYakala({ totalPrice: -500 });
    expect((e as { code: string }).code).toBe("INVALID_INPUT");
  });

  it("NaN tutar reddediliyor", async () => {
    const e = await reddiYakala({ totalPrice: Number.NaN });
    expect((e as { code: string }).code).toBe("INVALID_INPUT");
  });

  it("gecerli girdi bu kapidan GECIYOR", async () => {
    /*
      Kapinin fazla kapatmadigini olcer: gecerli girdi burada durmamali.
      (Sonrasinda Prisma sahte oldugu icin baska bir hata alinabilir; onemli
      olan hatanin INVALID_INPUT OLMAMASI.)
    */
    const e = await reddiYakala({});
    const kod = (e as { code?: string } | null)?.code;
    expect(kod).not.toBe("INVALID_INPUT");
  });
});

describe("red kodu iki tasiyicida da isleniyor", () => {
  it("web ve mobil haritalarinda INVALID_INPUT var", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const web = readFileSync(join(process.cwd(), "src/actions/booking.ts"), "utf-8");
    const mobil = readFileSync(
      join(process.cwd(), "src/app/api/mobile/checkout/intent/route.ts"),
      "utf-8",
    );
    // Haritalar `Record<BookingRejectionCode, ...>`; derleyici zaten zorluyor
    // ama kodun DUSURULMEDIGINI de olcelim.
    expect(web).toContain("INVALID_INPUT");
    expect(mobil).toMatch(/INVALID_INPUT: \{ status: 400/);
  });
});

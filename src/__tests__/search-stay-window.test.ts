import { describe, it, expect, vi, afterEach } from "vitest";
import { defaultSearchStayWindow } from "@/lib/search-defaults";
import { PLATFORM_TIMEZONE } from "@/lib/datetime-local";

/**
 * VARSAYILAN ARAMA SAATI PLATFORM DILIMINDE, SUNUCUNUNKINDE DEGIL.
 *
 * Uretimde olculdu (2026-09-02): arama sayfasi "yarin 10:00" demek isterken
 * kullaniciya 13:00 gosteriyordu. Sebep `checkIn.setHours(10, 0, 0, 0)` --
 * `setHours` CALISTIGI MAKINENIN yerel saatini kullanir ve uretim
 * konteynerinde `TZ` tanimli degil, yani UTC. 10:00 UTC = 13:00 Istanbul.
 *
 * Testin ozu: sonucu `PLATFORM_TIMEZONE`de okudugumuzda 10:00 gormeliyiz --
 * sureci CALISTIRAN makinenin saat dilimi ne olursa olsun.
 */
function saatiOku(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("varsayilan konaklama penceresi", () => {
  it("check-in platform saatinde 10:00", () => {
    const { checkIn } = defaultSearchStayWindow();
    expect(saatiOku(checkIn, PLATFORM_TIMEZONE)).toBe("10:00");
  });

  it("check-out tam 24 saat sonra", () => {
    const { checkIn, checkOut } = defaultSearchStayWindow();
    expect(checkOut.getTime() - checkIn.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("gun siniri PLATFORM diliminde geciliyor", () => {
    /*
      UTC 23:30'da Istanbul'da saat 02:30 ve gun ZATEN degismistir. "Yarin"i
      UTC gunune gore hesaplamak, platform icin bugunu isaret eder -- yani
      gecmise donuk ya da bir gun kaymis bir pencere.
    */
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T23:30:00Z"));
    const { checkIn } = defaultSearchStayWindow();

    const gun = new Intl.DateTimeFormat("en-CA", {
      timeZone: PLATFORM_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(checkIn);
    // Istanbul'da o an 2026-09-03 02:30; "yarin" 4 Eylul.
    expect(gun).toBe("2026-09-04");
    expect(saatiOku(checkIn, PLATFORM_TIMEZONE)).toBe("10:00");
  });

  it("check-in her zaman gelecekte", () => {
    const { checkIn } = defaultSearchStayWindow();
    expect(checkIn.getTime()).toBeGreaterThan(Date.now());
  });
});

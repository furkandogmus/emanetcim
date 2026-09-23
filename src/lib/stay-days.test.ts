import { describe, it, expect } from "vitest";
import {
  addDays,
  calendarDaysInclusive,
  dateOnlyFromParam,
  resolveStayWindow,
  searchWindowForDays,
  todayInZone,
} from "@/lib/stay-days";
import { computeStayDaysFromWindow, validateBookingStayWindow } from "@/lib/booking-server-price";

const SHOP = { openingTime: "09:00", closingTime: "20:00", open247: false, timeZone: "Europe/Istanbul" };
// 2026-09-23 07:00 Istanbul (04:00Z): dukkan henuz acilmadi.
const EARLY = new Date("2026-09-23T04:00:00Z");

describe("stay-days", () => {
  it("parametreden tarihi ayiklar", () => {
    expect(dateOnlyFromParam("2026-09-23")).toBe("2026-09-23");
    expect(dateOnlyFromParam("2026-09-23T14:00")).toBe("2026-09-23");
    expect(dateOnlyFromParam("2026-02-30")).toBeNull();
    expect(dateOnlyFromParam("abc")).toBeNull();
  });

  it("takvim gunu sayar", () => {
    expect(calendarDaysInclusive("2026-09-23", "2026-09-23")).toBe(1);
    expect(calendarDaysInclusive("2026-09-23", "2026-09-25")).toBe(3);
    expect(calendarDaysInclusive("2026-09-25", "2026-09-23")).toBe(0);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(todayInZone("Europe/Istanbul", EARLY)).toBe("2026-09-23");
  });

  it.each([
    ["2026-09-23", "2026-09-23", 1],
    ["2026-09-23", "2026-09-24", 2],
    ["2026-09-23", "2026-09-27", 5],
  ])("%s -> %s sunucuda %i gun fiyatlanir", (drop, pickup, days) => {
    const w = resolveStayWindow(drop, pickup, SHOP, EARLY)!;
    expect(validateBookingStayWindow(w.checkIn, w.checkOut, undefined, EARLY.getTime())).toBe(true);
    expect(computeStayDaysFromWindow(w.checkIn, w.checkOut)).toBe(days);
    expect(calendarDaysInclusive(drop, pickup)).toBe(days);
  });

  it("bugun dukkan acikken birakis simdiden baslar", () => {
    const now = new Date("2026-09-23T11:02:00Z"); // 14:02 Istanbul
    const w = resolveStayWindow("2026-09-23", "2026-09-24", SHOP, now)!;
    expect(w.checkIn.toISOString()).toBe("2026-09-23T11:05:00.000Z");
    expect(computeStayDaysFromWindow(w.checkIn, w.checkOut)).toBe(2);
  });

  it("kapanisa bir saatten az kaldiysa ayni gun birakilamaz", () => {
    const late = new Date("2026-09-23T16:30:00Z"); // 19:30 Istanbul
    expect(resolveStayWindow("2026-09-23", "2026-09-23", SHOP, late)).toBeNull();
    expect(resolveStayWindow("2026-09-23", "2026-09-24", SHOP, late)).not.toBeNull();
  });

  it("dukkan bugun kapandiysa bugunden baslayan cok gunluk kalis da olmaz", () => {
    const closed = new Date("2026-09-23T18:00:00Z"); // 21:00 Istanbul
    expect(resolveStayWindow("2026-09-23", "2026-09-25", SHOP, closed)).toBeNull();
    expect(resolveStayWindow("2026-09-24", "2026-09-25", SHOP, closed)).not.toBeNull();
  });

  it("7/24 dukkan gun sayisini korur", () => {
    const w = resolveStayWindow("2026-09-24", "2026-09-25", { open247: true, timeZone: "Europe/Istanbul" }, EARLY)!;
    expect(computeStayDaysFromWindow(w.checkIn, w.checkOut)).toBe(2);
  });

  it("arama penceresi gecerli", () => {
    const w = searchWindowForDays("2026-09-23", "2026-09-23", "Europe/Istanbul", EARLY)!;
    expect(validateBookingStayWindow(w.checkIn, w.checkOut, undefined, EARLY.getTime())).toBe(true);
  });
});

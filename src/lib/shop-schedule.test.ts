import { describe, expect, it } from "vitest";
import {
  hoursForDate,
  isOpenAt,
  isoWeekday,
  lastDropOffForDate,
  type ShopSchedule,
} from "./shop-schedule";

const day = (weekday: number, openingTime: string, closingTime: string, isClosed = false) => ({
  weekday,
  isClosed,
  openingTime,
  closingTime,
});

const base: ShopSchedule = {
  timeZone: "Europe/Istanbul",
  openingTime: "09:00",
  closingTime: "20:00",
};

describe("isoWeekday", () => {
  it("Pazartesi 1, Pazar 7", () => {
    expect(isoWeekday("2026-10-05")).toBe(1);
    expect(isoWeekday("2026-10-11")).toBe(7);
  });
});

describe("hoursForDate", () => {
  it("haftalik satiri olmayan dukkan eski cifte duser", () => {
    expect(hoursForDate(base, "2026-10-07")).toEqual({ open: "09:00", close: "20:00" });
  });

  it("haftalik satir gune gore saat verir, kapali gun null", () => {
    const s = { ...base, weekly: [day(6, "10:00", "16:00"), day(7, "09:00", "20:00", true)] };
    expect(hoursForDate(s, "2026-10-10")).toEqual({ open: "10:00", close: "16:00" });
    expect(hoursForDate(s, "2026-10-11")).toBeNull();
  });

  it("izin araligi uclar dahil kapatir, 7/24 dukkani da", () => {
    const s = { ...base, open247: true, closures: [{ startDate: "2026-10-12", endDate: "2026-10-14" }] };
    expect(hoursForDate(s, "2026-10-11")).not.toBeNull();
    expect(hoursForDate(s, "2026-10-12")).toBeNull();
    expect(hoursForDate(s, "2026-10-14")).toBeNull();
    expect(hoursForDate(s, "2026-10-15")).not.toBeNull();
  });

  it("7/24 haftalik satiri yok sayar", () => {
    const s = { ...base, open247: true, weekly: [day(3, "10:00", "11:00", true)] };
    expect(hoursForDate(s, "2026-10-07")).toEqual({ open: "00:00", close: "23:59" });
  });
});

describe("isOpenAt", () => {
  const s: ShopSchedule = { ...base, weekly: [day(1, "09:00", "18:00"), day(2, "09:00", "18:00", true)] };

  it("acik gun icinde acik, disinda kapali", () => {
    expect(isOpenAt(s, new Date("2026-10-05T12:00:00+03:00"))).toBe(true);
    expect(isOpenAt(s, new Date("2026-10-05T19:00:00+03:00"))).toBe(false);
  });

  it("kapali gunde kapali", () => {
    expect(isOpenAt(s, new Date("2026-10-06T12:00:00+03:00"))).toBe(false);
  });

  it("gece yarisini asan vardiya ertesi sabahin ilk saatlerini kapsar", () => {
    const night: ShopSchedule = { ...base, weekly: [day(5, "18:00", "02:00")] };
    expect(isOpenAt(night, new Date("2026-10-10T01:00:00+03:00"))).toBe(true);
    expect(isOpenAt(night, new Date("2026-10-10T03:00:00+03:00"))).toBe(false);
  });
});

describe("lastDropOffForDate", () => {
  it("kapanistan 30 dk once; kapali gunde null", () => {
    const s = { ...base, weekly: [day(1, "09:00", "18:00"), day(2, "09:00", "18:00", true)] };
    expect(lastDropOffForDate(s, "2026-10-05")).toBe("17:30");
    expect(lastDropOffForDate(s, "2026-10-06")).toBeNull();
  });
});

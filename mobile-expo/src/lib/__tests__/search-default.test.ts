import { describe, expect, it } from "@jest/globals";

import { defaultWindow } from "@/lib/search";

/** Anlar UTC ile kurulur; Istanbul = UTC+3. */
describe("defaultWindow", () => {
  it("birakma simdiden sonraki ilk yarim saat (13:05 -> 13:30), alma dort saat sonra", () => {
    const w = defaultWindow(new Date("2026-10-18T10:05:00Z"));
    expect(w.checkIn.toISOString()).toBe("2026-10-18T10:30:00.000Z");
    expect(w.checkOut.toISOString()).toBe("2026-10-18T14:30:00.000Z");
  });

  it("aksam 19:00 sonrasi ertesi sabah 09:00", () => {
    const w = defaultWindow(new Date("2026-10-18T16:10:00Z")); // 19:10 TRT
    expect(w.checkIn.toISOString()).toBe("2026-10-19T06:00:00.000Z");
  });

  it("sabaha karsi ayni gunun 09:00'i", () => {
    const w = defaultWindow(new Date("2026-10-18T02:00:00Z")); // 05:00 TRT
    expect(w.checkIn.toISOString()).toBe("2026-10-18T06:00:00.000Z");
  });
});

describe("defaultWindow.rolled", () => {
  it("aksam acilista yarina kayan pencere rolled", () => {
    expect(defaultWindow(new Date("2026-10-18T16:10:00Z")).rolled).toBe(true);
  });
  it("gun ici pencere rolled degil", () => {
    expect(defaultWindow(new Date("2026-10-18T10:05:00Z")).rolled).toBe(false);
  });
});

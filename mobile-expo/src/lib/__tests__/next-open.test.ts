import { describe, expect, it } from "@jest/globals";

import { openDayKind, shiftWindowTo } from "@/lib/next-open";

/** Anlar UTC ile kurulur; Istanbul = UTC+3. */
describe("shiftWindowTo", () => {
  it("aramayi sonraki acilisa kaydirir ve sureyi korur", () => {
    const w = shiftWindowTo(
      { date: "2026-11-21", at: "09:00" },
      new Date("2026-11-20T14:30:00Z"),
      new Date("2026-11-20T18:30:00Z"),
    )!;
    expect(w.checkIn.toISOString()).toBe("2026-11-21T06:00:00.000Z");
    expect(w.checkOut.toISOString()).toBe("2026-11-21T10:00:00.000Z");
  });

  it("bozuk girdide null", () => {
    expect(shiftWindowTo({ date: "x", at: "09:00" }, new Date(), new Date())).toBeNull();
  });
});

describe("openDayKind", () => {
  const now = new Date("2026-11-20T18:30:00Z"); // 21:30 TRT
  it("bugun / yarin / sonra", () => {
    expect(openDayKind({ date: "2026-11-20", at: "22:00" }, now)).toBe("today");
    expect(openDayKind({ date: "2026-11-21", at: "09:00" }, now)).toBe("tomorrow");
    expect(openDayKind({ date: "2026-11-23", at: "09:00" }, now)).toBe("later");
  });
});

import { describe, expect, it } from "@jest/globals";

import { isBookingExpired } from "../booking-state";

const NOW = new Date("2026-11-21T12:00:00Z").getTime();
const PAST = "2026-11-21T10:00:00Z";
const FUTURE = "2026-11-21T14:00:00Z";

describe("isBookingExpired", () => {
  it("sunucunun karari varsa onu kullanir", () => {
    expect(isBookingExpired({ status: "APPROVED", checkOutTime: FUTURE, expired: true }, NOW)).toBe(true);
    expect(isBookingExpired({ status: "APPROVED", checkOutTime: PAST, expired: false }, NOW)).toBe(false);
  });

  it("alan yoksa ayni kurali yerel saatle uygular", () => {
    expect(isBookingExpired({ status: "APPROVED", checkOutTime: PAST }, NOW)).toBe(true);
    expect(isBookingExpired({ status: "PAID", checkOutTime: PAST }, NOW)).toBe(true);
    expect(isBookingExpired({ status: "APPROVED", checkOutTime: FUTURE }, NOW)).toBe(false);
  });

  it("valiz dukkandaysa, iptal ya da tamamlanmissa dolmus degildir", () => {
    for (const status of ["CHECKED_IN", "CANCELLED", "CHECKED_OUT"]) {
      expect(isBookingExpired({ status, checkOutTime: PAST }, NOW)).toBe(false);
    }
  });
});

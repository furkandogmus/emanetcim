import { describe, expect, it } from "@jest/globals";

import { draftToValues, settingsToDraft } from "@/lib/admin-ops";
import type { AdminPlatformSettingsValues } from "@/lib/types";

const base: AdminPlatformSettingsValues = {
  maxStayDays: 30,
  maxBagsPerSlot: 50,
  insuranceFeeTry: 0,
  earlyRefundRatio: 1,
  cancelFixedFeeTry: 0,
  latePickupFeeTry: 0,
  latePickupGraceMin: 15,
  checkInGraceMin: 30,
  requireSealsOnCheckIn: false,
  defaultShopCapacity: 10,
  defaultPricePerDay: 250,
  bagMultiplierS: 0.8,
  bagMultiplierM: 1,
  bagMultiplierXl: 1.5,
  platformHolidayDates: [],
  minAppVersion: null,
  latestAppVersion: null,
};

describe("magaza yayin bayraklari (platform ayari)", () => {
  it("sunucu gondermezse kapali olarak geri gider", () => {
    const out = draftToValues(settingsToDraft(base));
    expect(out.iosAppStoreLive).toBe(false);
    expect(out.androidPlayLive).toBe(false);
  });

  it("acik deger korunur", () => {
    const out = draftToValues(settingsToDraft({ ...base, iosAppStoreLive: true, androidPlayLive: false }));
    expect(out.iosAppStoreLive).toBe(true);
    expect(out.androidPlayLive).toBe(false);
  });
});

describe("uygulama indirimi orani (platform ayari)", () => {
  it("eski sunucu alani gondermezse PUT govdesine girmez (oran sifirlanmaz)", () => {
    const out = draftToValues(settingsToDraft(base));
    expect("appBookingDiscountPct" in out).toBe(false);
  });

  it("deger sayi olarak geri gider, 0 dahil", () => {
    expect(draftToValues(settingsToDraft({ ...base, appBookingDiscountPct: 12.5 })).appBookingDiscountPct).toBe(12.5);
    expect(draftToValues(settingsToDraft({ ...base, appBookingDiscountPct: 0 })).appBookingDiscountPct).toBe(0);
  });
});

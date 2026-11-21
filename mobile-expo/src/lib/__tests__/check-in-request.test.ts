import { describe, expect, it, jest } from "@jest/globals";
import { ApiError } from "../api";
import { buildCheckInBody, shouldOfferOutsideHours } from "../check-in-request";

jest.mock("expo-secure-store", () => ({}));

describe("buildCheckInBody", () => {
  it("bos muhur satirlarini atar, bayrak yoksa govdeye yazmaz", () => {
    expect(buildCheckInBody([{ sealNumber: "", bagIndex: 0, bagSize: "S" }])).toEqual({});
  });

  it("onaylanan saat disi teslimde outsideHours tasir, muhurlerle birlikte", () => {
    expect(buildCheckInBody([{ sealNumber: "12", bagIndex: 0, bagSize: "M" }], { outsideHours: true })).toEqual({
      sealAssignments: [{ sealNumber: 12, bagIndex: 0, bagSize: "M" }],
      faultySealNumbers: [],
      outsideHours: true,
    });
  });
});

describe("shouldOfferOutsideHours", () => {
  it("ilk SHOP_CLOSED'da onay sorar", () => {
    expect(shouldOfferOutsideHours(new ApiError(400, "SHOP_CLOSED"), false)).toBe(true);
  });

  it("onayli yineleme yine reddedilirse tekrar sormaz (dongu yok)", () => {
    expect(shouldOfferOutsideHours(new ApiError(400, "SHOP_CLOSED"), true)).toBe(false);
  });

  it("baska hatalarda sormaz", () => {
    expect(shouldOfferOutsideHours(new ApiError(400, "PAYMENT_REQUIRED"), false)).toBe(false);
    expect(shouldOfferOutsideHours(new Error("x"), false)).toBe(false);
  });
});

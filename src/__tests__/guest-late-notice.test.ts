import { describe, it, expect } from "vitest";
import { guestLateNotice, type LateSubject } from "@/lib/late-dropoff";
import { guestCancelOptions, isBookingExpired } from "@/lib/booking-closure";

/** Web misafir rezervasyon sayfasindaki gec birakma bandi ve suresi dolma (mobil ile ayni kural). */

const CHECK_IN = new Date("2030-05-01T10:00:00Z");
const CHECK_OUT = new Date("2030-05-01T12:00:00Z");
const min = (n: number) => new Date(CHECK_IN.getTime() + n * 60_000);
const b = (over: Partial<LateSubject> = {}): LateSubject => ({
  status: "APPROVED",
  checkInTime: CHECK_IN,
  checkOutTime: CHECK_OUT,
  checkedInAt: null,
  lateHoldUntil: null,
  ...over,
});

describe("guestLateNotice", () => {
  it("birakma saatinden once bant yok", () => {
    expect(guestLateNotice(b(), min(-1))).toBeNull();
  });

  it("gec kalinca otomatik kapanis ani (+60 dk) doner", () => {
    expect(guestLateNotice(b(), min(10))).toEqual({ closeAt: min(60), holdUntil: null });
  });

  it("esnaf bekletiyorsa 'esnaf bekliyor' ani doner", () => {
    expect(guestLateNotice(b({ lateHoldUntil: min(90) }), min(70))).toEqual({ closeAt: min(90), holdUntil: min(90) });
  });

  it("bekletme bittiyse yalniz kapanis", () => {
    expect(guestLateNotice(b({ lateHoldUntil: min(50) }), min(55))?.holdUntil).toBeNull();
  });

  it("valiz birakildiysa ya da iptalse bant yok", () => {
    expect(guestLateNotice(b({ checkedInAt: min(5), status: "CHECKED_IN" }), min(10))).toBeNull();
    expect(guestLateNotice(b({ status: "CANCELLED" }), min(10))).toBeNull();
  });
});

describe("isBookingExpired", () => {
  it("birakilmamis ve alma saati gecmis", () => {
    expect(isBookingExpired({ status: "APPROVED", checkOutTime: CHECK_OUT }, min(121))).toBe(true);
    expect(isBookingExpired({ status: "APPROVED", checkOutTime: CHECK_OUT }, min(119))).toBe(false);
    expect(isBookingExpired({ status: "CHECKED_IN", checkOutTime: CHECK_OUT }, min(200))).toBe(false);
  });
});

describe("guestCancelOptions", () => {
  it("suresi dolani kapatmak expired_no_dropoff, esnafa bildirim yok", () => {
    expect(guestCancelOptions({ status: "APPROVED", checkOutTime: CHECK_OUT }, min(121))).toEqual({
      reason: "expired_no_dropoff",
      notifyPartner: false,
    });
  });

  it("suresi dolmamis rezervasyonda normal misafir iptali", () => {
    expect(guestCancelOptions({ status: "APPROVED", checkOutTime: CHECK_OUT }, min(10))).toEqual({ reason: "guest_cancel" });
  });
});

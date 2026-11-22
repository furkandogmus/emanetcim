import { describe, it, expect } from "vitest";
import { cancelReasonFromEvents, noShowAvailableAt } from "@/lib/booking-closure";
import { toMobileBookingDetail, toMobileBookingSummary, toMobilePartnerBookingRow } from "@/lib/mobile-dto";

const CHECK_IN = new Date("2030-05-01T10:00:00Z");

describe("noShowAvailableAt", () => {
  it("birakilmamis durumlarda check-in + 60 dk", () => {
    for (const status of ["PENDING", "WAITING_APPROVAL", "APPROVED", "PAID"]) {
      expect(noShowAvailableAt({ status, checkInTime: CHECK_IN })?.toISOString(), status).toBe(
        "2030-05-01T11:00:00.000Z",
      );
    }
  });

  it("durum izin vermiyorsa null", () => {
    for (const status of ["CHECKED_IN", "CHECKED_OUT", "CANCELLED"]) {
      expect(noShowAvailableAt({ status, checkInTime: CHECK_IN }), status).toBeNull();
    }
  });
});

describe("cancelReasonFromEvents", () => {
  const ev = (minute: number, metadata: unknown, event = "CANCELLED") => ({
    event,
    metadata,
    createdAt: new Date(Date.UTC(2030, 0, 1, 0, minute)),
  });

  it("nedeni olan en son CANCELLED olayini secer", () => {
    expect(
      cancelReasonFromEvents([ev(1, { reason: "guest_cancel" }), ev(2, { reason: "admin_cancel" }), ev(3, null)]),
    ).toBe("admin_cancel");
  });

  it("eski red nedenlerini yeni sozlesmeye cevirir", () => {
    // Eski red yolu biri nedensiz iki CANCELLED olayi yaziyordu.
    expect(cancelReasonFromEvents([ev(1, { previousStatus: "APPROVED" }), ev(1, { reason: "rejected_by_partner" })])).toBe(
      "partner_cancel",
    );
    expect(cancelReasonFromEvents([ev(1, { reason: "cancelled_by_admin" })])).toBe("admin_cancel");
  });

  it("neden yoksa, bilinmiyorsa ya da olay iptal degilse null", () => {
    expect(cancelReasonFromEvents([])).toBeNull();
    expect(cancelReasonFromEvents([ev(1, { reason: "nonsense" })])).toBeNull();
    expect(cancelReasonFromEvents([ev(1, { reason: "no_show" }, "CHECKED_OUT")])).toBeNull();
  });
});

const BOOKING = {
  id: "b1",
  shopId: "s1",
  shop: { name: "Dükkan", latitude: 41, longitude: 29, owner: { phone: "555" } },
  checkInTime: CHECK_IN,
  checkOutTime: new Date("2030-05-01T18:00:00Z"),
  bagCountS: 1,
  bagCountM: 0,
  bagCountXl: 0,
  totalPrice: 100,
  status: "PAID",
  qrCodeToken: "qr",
  guest: { name: "Ada" },
  seals: [],
};

describe("mobil DTO kapanis alanlari", () => {
  it("cancelReason yalniz CANCELLED kayitta dolu", () => {
    expect(toMobileBookingSummary({ ...BOOKING, status: "CANCELLED", cancelReason: "no_show" }).cancelReason).toBe(
      "no_show",
    );
    expect(toMobileBookingSummary({ ...BOOKING, cancelReason: "no_show" }).cancelReason).toBeNull();
    expect(toMobileBookingSummary(BOOKING).cancelReason).toBeNull();
  });

  it("noShowAvailableAt esnaf/yonetici icin dolu, misafir icin null", () => {
    expect(toMobileBookingDetail(BOOKING, { operator: true }).noShowAvailableAt).toBe("2030-05-01T11:00:00.000Z");
    expect(toMobileBookingDetail(BOOKING).noShowAvailableAt).toBeNull();
    expect(toMobileBookingDetail({ ...BOOKING, status: "CHECKED_IN" }, { operator: true }).noShowAvailableAt).toBeNull();
  });

  it("esnaf liste satiri eski alanlari korur ve cancelReason tasir", () => {
    const row = toMobilePartnerBookingRow(
      { ...BOOKING, status: "CANCELLED", cancelReason: "partner_cancel", guest: { name: "Ada" } },
      "Dükkan",
    );
    expect(row).toMatchObject({ id: "b1", shopName: "Dükkan", guestName: "Ada", totalPrice: 100, cancelReason: "partner_cancel" });
  });
});

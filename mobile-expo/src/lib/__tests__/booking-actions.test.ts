import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { ApiError } from "../api";
import {
  BOOKING_ACTIONS_NS,
  adminActionFor,
  canPartnerCancel,
  cancelReasonKey,
  cancelReasonOf,
  isAdminNoteValid,
  isSameWallDay,
  lateDropoffState,
  noShowState,
  partnerCancelBody,
} from "../booking-actions";
import { errorMessage } from "../errors";
import i18n from "../i18n";
import type { CancelReason } from "../types";

jest.mock("expo-secure-store", () => ({}));

describe("adminActionFor / canPartnerCancel", () => {
  it("valiz birakilmadan once iptal, dukkandayken zorla teslim, sonrasinda hicbiri", () => {
    for (const s of ["PENDING", "WAITING_APPROVAL", "APPROVED", "PAID"] as const) {
      expect(adminActionFor(s)).toBe("cancel");
      expect(canPartnerCancel(s)).toBe(true);
    }
    expect(adminActionFor("CHECKED_IN")).toBe("forceCheckout");
    expect(canPartnerCancel("CHECKED_IN")).toBe(false);
    expect(adminActionFor("CHECKED_OUT")).toBeNull();
    expect(adminActionFor("CANCELLED")).toBeNull();
  });
});

describe("isAdminNoteValid", () => {
  it("bosluklar sayilmaz, en az 5 karakter", () => {
    expect(isAdminNoteValid("    abcd  ")).toBe(false);
    expect(isAdminNoteValid(" abcde ")).toBe(true);
  });
});

describe("partnerCancelBody", () => {
  it("neden secilmeden gonderilmez", () => {
    expect(partnerCancelBody(null, "not")).toBeNull();
  });
  it("Diger not ister; bosluk not sayilmaz", () => {
    expect(partnerCancelBody("other", "   ")).toBeNull();
    expect(partnerCancelBody("other", "  su kesik ")).toEqual({ reason: "other", note: "su kesik" });
  });
  it("diger nedenlerde bos not hic gonderilmez", () => {
    expect(partnerCancelBody("capacity", "  ")).toEqual({ reason: "capacity" });
    expect(partnerCancelBody("shop_closed", "tadilat")).toEqual({ reason: "shop_closed", note: "tadilat" });
  });
});

describe("noShowState", () => {
  const now = Date.parse("2026-11-22T10:00:00Z");
  it("alan yok (eski sunucu) ya da null: gizli", () => {
    expect(noShowState(undefined, now)).toEqual({ kind: "hidden" });
    expect(noShowState(null, now)).toEqual({ kind: "hidden" });
    expect(noShowState("bozuk", now)).toEqual({ kind: "hidden" });
  });
  it("zaman gelmeden bekler, gelince acilir (sinir dahil)", () => {
    const s = noShowState("2026-11-22T10:30:00Z", now);
    expect(s.kind).toBe("waiting");
    expect(s.kind === "waiting" && s.at.toISOString()).toBe("2026-11-22T10:30:00.000Z");
    expect(noShowState("2026-11-22T10:00:00Z", now)).toEqual({ kind: "ready" });
  });
  it("gun karsilastirmasi Istanbul saatiyle", () => {
    // 21:30Z = 00:30 TRT ertesi gun.
    expect(isSameWallDay("2026-11-22T10:00:00Z", "2026-11-22T21:30:00Z")).toBe(false);
    expect(isSameWallDay("2026-11-22T10:00:00Z", "2026-11-22T20:30:00Z")).toBe(true);
  });
});

describe("cancelReasonOf / cancelReasonKey", () => {
  it("yalnizca iptal edilmis rezervasyonda ve bilinen degerde okunur", () => {
    expect(cancelReasonOf({ status: "CANCELLED", cancelReason: "no_show" })).toBe("no_show");
    expect(cancelReasonOf({ status: "CANCELLED" })).toBeNull();
    expect(cancelReasonOf({ status: "CANCELLED", cancelReason: "gelecekte_eklenen" })).toBeNull();
    expect(cancelReasonOf({ status: "CHECKED_OUT", cancelReason: "no_show" })).toBeNull();
  });

  it("misafir kendi iptalini 'sen' diye okur", () => {
    expect(cancelReasonKey("guest_cancel", "long", "guest")).toBe("cancelReason.guestSelf");
    expect(cancelReasonKey("guest_cancel", "long", "staff")).toBe("cancelReason.long.guest_cancel");
    expect(cancelReasonKey(null, "short")).toBeNull();
  });

  it("her neden her dilde iki bicimde de cevrili", () => {
    const reasons: CancelReason[] = ["guest_cancel", "partner_cancel", "no_show", "admin_cancel", "expired_no_dropoff"];
    for (const lng of ["tr", "en", "de", "fr", "ja", "ru"]) {
      for (const r of reasons) {
        for (const v of ["short", "long"] as const) {
          expect(i18n.exists(cancelReasonKey(r, v)!, { lng })).toBe(true);
        }
      }
    }
  });
});

describe("hata kodlari", () => {
  beforeAll(() => i18n.changeLanguage("tr"));
  const generic = () => i18n.t("common.genericError");

  it("yonetim uclarinin bilinen her kodu genel mesaja dusmez", () => {
    for (const code of ["not_found", "forbidden", "invalid_status", "note_required", "invalid_reason", "too_early", "server_error"]) {
      expect(errorMessage(new ApiError(400, code), BOOKING_ACTIONS_NS)).not.toBe(generic());
    }
  });

  it("uc henuz yoksa (eski sunucu, HTML 404) web paneline yonlendirir", () => {
    expect(errorMessage(new ApiError(404, "http_404"), BOOKING_ACTIONS_NS)).toBe(i18n.t("bookingActions.errors.http_404"));
  });

  it("misafir iptalinin bilinen her kodu cevrili", () => {
    for (const code of ["invalid_status", "not_found", "forbidden", "cancel_failed", "server_error"]) {
      expect(errorMessage(new ApiError(400, code), "bookings")).not.toBe(generic());
    }
  });
});

describe("lateDropoffState", () => {
  const base = {
    status: "PAID" as const,
    checkInTime: "2026-11-22T09:00:00Z",
    checkOutTime: "2026-11-22T15:00:00Z",
  };
  const at = (iso: string) => Date.parse(iso);

  it("eski sunucu (alan yok) ve birakma saatinden once gizli", () => {
    expect(lateDropoffState(base, at("2026-11-22T09:20:00Z"))).toEqual({ kind: "hidden" });
    expect(lateDropoffState({ ...base, lateCloseAt: "2026-11-22T10:00:00Z" }, at("2026-11-22T08:59:00Z"))).toEqual({
      kind: "hidden",
    });
  });

  it("gec: kapanis ani, bekletme yok, bekletilebilir", () => {
    const s = lateDropoffState({ ...base, lateCloseAt: "2026-11-22T10:00:00Z" }, at("2026-11-22T09:20:00Z"));
    expect(s).toEqual({
      kind: "late",
      closeAt: new Date("2026-11-22T10:00:00Z"),
      holdUntil: null,
      actionable: true,
      canHold: true,
    });
  });

  it("suren bekletme gosterilir; alma saatine dayanmis kapanis bekletilemez", () => {
    const s = lateDropoffState(
      { ...base, lateCloseAt: "2026-11-22T15:00:00Z", lateHoldUntil: "2026-11-22T15:00:00Z" },
      at("2026-11-22T14:00:00Z"),
    );
    expect(s).toMatchObject({ kind: "late", holdUntil: new Date("2026-11-22T15:00:00Z"), canHold: false });
  });

  it("odemesiz niyet (PENDING) bekletilemez ve bekle blogu sunulmaz", () => {
    const s = lateDropoffState({ ...base, status: "PENDING", lateCloseAt: "2026-11-22T10:00:00Z" }, at("2026-11-22T09:20:00Z"));
    expect(s).toMatchObject({ kind: "late", actionable: false, canHold: false });
  });
});

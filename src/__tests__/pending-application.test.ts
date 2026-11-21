import { describe, it, expect } from "vitest";
import { PENDING_APPLICATION_WHERE } from "@/lib/pending-application";

describe("bekleyen başvuru tanımı", () => {
  it("onaylanmamış, pasif ve rezervasyonsuz dükkanı kapsar", () => {
    // Pasife alinmis canli dukkan listeye dusup "Reddet" ile silinmesin.
    expect(PENDING_APPLICATION_WHERE).toEqual({
      isActive: false,
      approvedAt: null,
      bookings: { none: {} },
    });
  });
});

import { phoneSearchDigits } from "@/lib/admin-phone-search";

describe("admin telefon araması", () => {
  it("yazım biçimi ne olursa olsun 10 haneye iner", () => {
    for (const q of ["0532 123 45 67", "+90 532 123 45 67", "(532) 123-45-67", "5321234567", "905321234567"]) {
      expect(phoneSearchDigits(q)).toBe("5321234567");
    }
  });
  it("kısmi yazımı eşler, çok kısa diziyi yok sayar", () => {
    expect(phoneSearchDigits("0532 123 4")).toBe("5321234");
    expect(phoneSearchDigits("0532 123")).toBeNull();
    expect(phoneSearchDigits("158D19")).toBeNull();
  });
});

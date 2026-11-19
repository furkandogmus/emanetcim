import { describe, expect, it } from "@jest/globals";

import { formatDistance, formatKm, formatStayRange, stayDays, initial } from "@/lib/format";

const at = (iso: string) => new Date(iso);

describe("stayDays", () => {
  // Sunucudaki `computeStayDaysFromWindow` ile aynı kural: başlayan her 24 saat bir gün.
  it("aynı gün içindeki kısa kalış 1 gündür", () => {
    expect(stayDays(at("2026-10-18T07:00:00Z"), at("2026-10-18T10:00:00Z"))).toBe(1);
  });

  it("tam 24 saat 1, bir dakika fazlası 2 gündür", () => {
    expect(stayDays(at("2026-10-18T07:00:00Z"), at("2026-10-19T07:00:00Z"))).toBe(1);
    expect(stayDays(at("2026-10-18T07:00:00Z"), at("2026-10-19T07:01:00Z"))).toBe(2);
  });

  it("ters ya da geçersiz aralık 1 gün sayılır, sıfır ya da negatif fiyat çıkmaz", () => {
    expect(stayDays(at("2026-10-19T07:00:00Z"), at("2026-10-18T07:00:00Z"))).toBe(1);
    expect(stayDays(new Date(NaN), at("2026-10-18T07:00:00Z"))).toBe(1);
  });
});

describe("formatKm", () => {
  it("10 km altı bir ondalık, üstü tam sayı", () => {
    expect(formatKm(0.86)).toBe("0.9");
    expect(formatKm(9.94)).toBe("9.9");
    expect(formatKm(12.6)).toBe("13");
  });
});

describe("initial", () => {
  it("NFD gelen adda birlesik karakteri tek harf olarak alir", () => {
    expect(initial("O\u0308rnek Esnaf")).toBe("Ö");
  });
  it("Turkce buyuk harf kurali", () => {
    expect(initial("ilker")).toBe("İ");
  });
  it("bos ad", () => {
    expect(initial("   ")).toBe("?");
  });
});


describe("formatStayRange", () => {
  it("ayni Istanbul gununde tarihi tekrar yazmaz", () => {
    expect(formatStayRange("2026-11-19T14:30:00Z", "2026-11-19T18:30:00Z")).not.toMatch(/19/);
  });
  it("farkli gunde alma tarihini yazar", () => {
    expect(formatStayRange("2026-11-19T14:30:00Z", "2026-11-21T08:00:00Z")).toMatch(/21/);
  });
});

describe("formatDistance", () => {
  it("1 km altini metreyle yazar", () => {
    expect(formatDistance(0.04)).toBe("40 m");
    expect(formatDistance(0)).toBe("10 m");
    expect(formatDistance(0.456)).toBe("460 m");
  });
  it("1 km ve ustunu km ile yazar", () => {
    expect(formatDistance(2)).toMatch(/^2[.,]0 km$/);
  });
});

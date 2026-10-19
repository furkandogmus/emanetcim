import { describe, expect, it } from "@jest/globals";

import { formatKm, stayDays } from "@/lib/format";

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

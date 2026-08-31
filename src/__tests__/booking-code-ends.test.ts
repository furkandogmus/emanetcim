import { describe, it, expect } from "vitest";
import {
  bookingShortCode,
  normalizeBookingCode,
  MIN_BOOKING_CODE_LENGTH,
} from "@/lib/booking-code";

/**
 * Bu testin koruduğu şey bir fonksiyon değil, İKİ UCUN BULUŞMASI.
 *
 * Kod üç yerde görünüyor: misafirin rezervasyon sayfası, e-posta/SMS
 * bildirimleri ve `/bookings/lookup` formu. Yazan uç `bookingShortCode`,
 * okuyan uç `normalizeBookingCode` + Postgres `startsWith`. İkisi ayrı ayrı
 * doğru olabilir ve yine de buluşmayabilir -- nitekim buluşmuyordu: sayfa
 * BÜYÜK harf gösteriyordu, `startsWith` harf duyarlıydı ve misafir KENDİ
 * ekranındaki kodu yazınca "Rezervasyon bulunamadı" alıyordu.
 *
 * Yani burada ölçülen şey şu tek cümle: misafirin gördüğü kod, misafirin
 * yazdığı hâliyle, saklanan kimliğe geri götürür.
 */
describe("rezervasyon kodu: yazan uç ile okuyan uç", () => {
  const id = "2a9e8619-4f3b-4c21-9a77-0d5e6f7a8b90";

  it("misafirin gördüğü kod, normalize edilince kimliğin başına oturur", () => {
    const gorunen = bookingShortCode(id);
    expect(gorunen).toBe("2A9E8619");
    // Sorgunun yaptığı iş: normalize et, sonra kimliğin başıyla karşılaştır.
    expect(id.replace(/-/g, "").startsWith(normalizeBookingCode(gorunen))).toBe(true);
  });

  it("misafirin elle yazabileceği biçimler de aynı yere gider", () => {
    const gorunen = bookingShortCode(id);
    // Telefonda okunarak aktarılıyor: boşluklu, tireli, küçük harfli olağan.
    for (const yazim of [gorunen, gorunen.toLowerCase(), "2a9e 8619", "2A9E-8619", " 2a9e8619 "]) {
      expect(normalizeBookingCode(yazim)).toBe(gorunen.toLowerCase());
    }
  });

  it("üretilen kod, aramanın kabul ettiği alt sınırdan kısa değil", () => {
    expect(bookingShortCode(id).length).toBeGreaterThanOrEqual(MIN_BOOKING_CODE_LENGTH);
  });
});

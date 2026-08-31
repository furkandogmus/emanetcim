import { describe, it, expect } from "vitest";
import { toWhatsAppNumber, waMeUrl } from "@/lib/whatsapp";

/**
 * wa.me numara biçimi: ULUSLARARASI, yalnızca rakam, artı yok, baştaki sıfır
 * yok. Bozuk bir bağlantı WhatsApp'ta "numara geçersiz" ekranı açar; o yüzden
 * çevrilemeyen her girdi `null` dönmeli ve düğme HİÇ çizilmemeli.
 */
describe("wa.me numara çevirimi", () => {
  it("veritabanındaki E.164 biçimini çevirir", () => {
    // `User.phone` uretimde bu bicimde duruyor.
    expect(toWhatsAppNumber("+905001112233")).toBe("905001112233");
  });

  it("TR yerel yazımlarını ülke koduyla tamamlar", () => {
    for (const input of ["05001112233", "5001112233", "0500 111 22 33", "(0500) 111-2233"]) {
      expect(toWhatsAppNumber(input), input).toBe("905001112233");
    }
  });

  it("artısız yazılmış TR uluslararası numarayı olduğu gibi kabul eder", () => {
    expect(toWhatsAppNumber("905001112233")).toBe("905001112233");
  });

  it("`00` çıkış önekini uluslararası sayar", () => {
    expect(toWhatsAppNumber("00905001112233")).toBe("905001112233");
    expect(toWhatsAppNumber("00441234567890")).toBe("441234567890");
  });

  it("YABANCI numaraya TR kodu EKLEMEZ", () => {
    /*
      Misafirlerin cogu yabanci. `+44...`in basina 90 eklemek yanlis ulkeye
      baglanti uretirdi -- sessizce yanlis kisiye yazmak, hic yazamamaktan kotu.
    */
    expect(toWhatsAppNumber("+441234567890")).toBe("441234567890");
    expect(toWhatsAppNumber("+12125551234")).toBe("12125551234");
    expect(toWhatsAppNumber("+819012345678")).toBe("819012345678");
  });

  it("çevrilemeyen girdiye null döner — düğme çizilmez", () => {
    for (const bad of [null, undefined, "", "   ", "abc", "123", "0", "+", "12345678901234567890"]) {
      expect(toWhatsAppNumber(bad as string | null | undefined), String(bad)).toBeNull();
    }
  });

  it("artısız ve TR kalıbına uymayan diziye ülke kodu UYDURMAZ", () => {
    // 9 haneli, artisiz: hangi ulke oldugu bilinemez.
    expect(toWhatsAppNumber("123456789")).toBeNull();
  });
});

describe("wa.me bağlantısı", () => {
  it("numara yoksa bağlantı da yok", () => {
    expect(waMeUrl(null)).toBeNull();
    expect(waMeUrl("abc")).toBeNull();
  });

  it("hazır metni URL olarak kodlar", () => {
    const url = waMeUrl("+905001112233", "Merhaba, BagajPark rezervasyonunuz için yazıyorum #A1B2");
    expect(url).toContain("https://wa.me/905001112233?text=");
    // Turkce karakterler ve `#` ham gecerse baglanti kirilir.
    expect(url).not.toContain("#");
    expect(url).not.toContain(" ");
    expect(decodeURIComponent(url!.split("?text=")[1])).toContain("rezervasyonunuz");
  });

  it("boş metinle sade bağlantı üretir", () => {
    expect(waMeUrl("+905001112233", "   ")).toBe("https://wa.me/905001112233");
    expect(waMeUrl("+905001112233")).toBe("https://wa.me/905001112233");
  });
});

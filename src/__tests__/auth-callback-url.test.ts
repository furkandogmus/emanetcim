import { describe, it, expect } from "vitest";
import { sanitizeAuthCallbackUrl } from "@/lib/auth-callback-url";

/**
 * `callbackUrl` AÇIK YÖNLENDİRMEYE kapalı olmalı.
 *
 * NEDEN (2026-08-31'de ölçüldü): sanitizer yalnızca `//` ile başlayan değerleri
 * eliyordu. Ama WHATWG URL ayrıştırıcısı http(s) gibi "özel" şemalarda ters
 * bölüyü eğik çizgiyle EŞ sayar ve tab/satır başı karakterlerini URL'den atar.
 * Sonuç: `//` ile BAŞLAMAYAN ama tarayıcıda protokol-göreli hâle gelen değerler
 * süzgeçten geçiyordu.
 *
 *   `/\evil.com`  → eski sanitize aynen geçiriyordu → tarayıcı https://evil.com/
 *   `/\tevil`     → aynen geçiyordu                 → tarayıcı https://tevil/
 *
 * Saldırı: kurbana `.../login?callbackUrl=/\evil.com` gönderilir; kurban giriş
 * yapar ve saldırganın sitesine düşer. Adres çubuğunda gerçek site göründüğü
 * için kimlik avı ikna edici olur.
 */

/** Testin kendisi de tarayıcı kuralını kullanır: sonuç aynı origin'de mi? */
function resolvesToSameOrigin(value: string): boolean {
  const base = "https://bagajpark.com";
  return new URL(sanitizeAuthCallbackUrl(value), base).origin === base;
}

describe("sanitizeAuthCallbackUrl", () => {
  it("meşru iç yolları OLDUĞU GİBİ korur", () => {
    expect(sanitizeAuthCallbackUrl("/tr/bookings")).toBe("/tr/bookings");
    expect(sanitizeAuthCallbackUrl("/tr/partner?tab=seals")).toBe("/tr/partner?tab=seals");
  });

  it("boş / tanımsız girdide köke düşer", () => {
    expect(sanitizeAuthCallbackUrl(null)).toBe("/");
    expect(sanitizeAuthCallbackUrl(undefined)).toBe("/");
    expect(sanitizeAuthCallbackUrl("   ")).toBe("/");
  });

  it("protokol-göreli adresi reddeder", () => {
    expect(resolvesToSameOrigin("//evil.com")).toBe(true);
  });

  it("TERS BÖLÜ ile atlatmaya izin vermez", () => {
    // Asil acik buydu: `//` degil ama tarayicida protokol-goreli.
    for (const attack of ["/\\evil.com", "/\\/evil.com", "/\\\\evil.com"]) {
      expect(resolvesToSameOrigin(attack), attack).toBe(true);
    }
  });

  it("URL'den atılan kontrol karakterleriyle atlatmaya izin vermez", () => {
    // Tarayici tab/satir basi karakterlerini atar; atildiktan sonra
    // "/ /evil.com" -> "//evil.com" olur.
    for (const attack of ["/\t/evil.com", "/\n/evil.com", "/\r\n/evil.com"]) {
      expect(resolvesToSameOrigin(attack), JSON.stringify(attack)).toBe(true);
    }
  });

  it("dış mutlak URL'yi yalnızca path'e indirger", () => {
    expect(sanitizeAuthCallbackUrl("https://evil.com/tr/bookings")).toBe("/tr/bookings");
    expect(resolvesToSameOrigin("https://evil.com/x")).toBe(true);
  });

  it("javascript: ve data: şemalarını geçirmez", () => {
    for (const attack of ["javascript:alert(1)", "data:text/html,<script>1</script>"]) {
      expect(resolvesToSameOrigin(attack), attack).toBe(true);
    }
  });
});

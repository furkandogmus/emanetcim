import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/*
  `@/i18n/routing` test ortaminda dogrudan import EDILEMIYOR: `createNavigation`
  `next/navigation`i cekiyor ve vitest'te cozulemiyor. `notification-locale-coverage`
  ayni sorunu dosyayi METIN olarak okuyarak asiyor; burada da oyle yapiliyor,
  ve asagidaki test mock listesinin gercek listeden sapmadigini dogruluyor --
  yoksa mock, olcmesi gereken seyi gizlerdi.
*/
const GERCEK_DILLER = (() => {
  const src = readFileSync(join(process.cwd(), "src/i18n/routing.ts"), "utf8");
  const blok = src.slice(src.indexOf("locales: ["), src.indexOf("]", src.indexOf("locales: [")));
  return [...blok.matchAll(/'([a-z]{2})'/g)].map((m) => m[1]);
})();

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["tr", "en", "de", "fr", "ja", "fa"], defaultLocale: "tr" },
}));

const { resolveRequestLocale, DEFAULT_NOTIFICATION_LOCALE } = await import(
  "@/lib/request-locale"
);
const { routing } = await import("@/i18n/routing");

/**
 * MISAFIRIN DILI REZERVASYONDA SAKLANIR.
 *
 * `hardcoded-copy` mandalinin kendi notu bu hatayi tasiyordu: "Icindeki tek
 * MISAFIR yuzeyi `booking-reminders` (3 satir): hatirlatma e-postalari sabit
 * Turkce ... yani Japon bir misafire Turkce e-posta gidiyor. Duzeltmesi kod
 * degil SEMA isi -- rezervasyonda misafirin dili saklanmiyor."
 *
 * Urun Amsterdam, Londra ve Berlin noktalariyla Turkiye disina cikiyor; o
 * noktalardaki misafire Turkce e-posta gondermek artik kenar durum degil.
 *
 * `Booking.locale` eklendi (nullable -- eski satirlar icin davranis degismez),
 * iki tasiyici da dolduruyor ve hatirlatmalar `NotificationService` uzerinden
 * `pickLocale` ile yaziliyor.
 */

const oku = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), "utf-8"));

describe("Accept-Language cozumlemesi", () => {
  it("q degerine gore siralar, soldan ilk eslesmeyi almaz", () => {
    // Soldan okuyan bir uygulama `de` derdi; dogru cevap `en`.
    expect(resolveRequestLocale("de;q=0.7, en;q=0.9")).toBe("en");
  });

  it("bolge etiketini dusurur", () => {
    expect(resolveRequestLocale("en-GB,en;q=0.9")).toBe("en");
    expect(resolveRequestLocale("de-CH")).toBe("de");
  });

  it("desteklenmeyen dil varsayilana duser", () => {
    expect(resolveRequestLocale("es-ES,es;q=0.9")).toBe(DEFAULT_NOTIFICATION_LOCALE);
    expect(resolveRequestLocale(null)).toBe(DEFAULT_NOTIFICATION_LOCALE);
    expect(resolveRequestLocale("")).toBe(DEFAULT_NOTIFICATION_LOCALE);
  });

  it("q=0 olan dil secilmez", () => {
    expect(resolveRequestLocale("ja;q=0, en;q=0.5")).toBe("en");
  });

  it("mock listesi routing.ts ile ayni", () => {
    // Sapma olursa bu test, digerlerinin sessizce yanlis sey olcmesini onler.
    expect([...routing.locales].sort()).toEqual([...GERCEK_DILLER].sort());
  });

  it("desteklenen her dili tanir", () => {
    for (const l of routing.locales) {
      expect(resolveRequestLocale(l)).toBe(l);
    }
  });
});

describe("dil rezervasyona yaziliyor", () => {
  it("sema alani duruyor", () => {
    const sema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf-8");
    expect(sema).toMatch(/^\s*locale\s+String\?/m);
  });

  it("migration alani ekliyor", () => {
    const sql = readFileSync(
      join(process.cwd(), "prisma/migrations/20260902090000_rezervasyonda_misafir_dili/migration.sql"),
      "utf-8",
    );
    expect(sql).toContain('ALTER TABLE "Booking" ADD COLUMN "locale" TEXT');
    // NOT NULL / DEFAULT eklemek mevcut satirlar icin tabloyu yeniden yazardi.
    expect(sql).not.toMatch(/ADD COLUMN "locale"[^;]*NOT NULL/);
  });

  it("her iki tasiyici da dolduruyor", () => {
    expect(oku("src/actions/booking.ts"), "web action").toContain("locale: await getLocale()");
    expect(oku("src/app/api/mobile/checkout/intent/route.ts"), "mobil uc").toContain(
      "resolveRequestLocale(req.headers.get(\"accept-language\"))",
    );
  });

  it("servis onu KAYDEDIYOR", () => {
    expect(oku("src/services/booking/create.ts")).toContain("locale: data.locale ?? null");
  });
});

describe("hatirlatmalar artik duz Turkce degil", () => {
  const uc = oku("src/app/api/internal/booking-reminders/route.ts");

  it("misafir e-postalari servis uzerinden gidiyor", () => {
    expect(uc).toContain("sendStayReminder");
  });

  it("uc icinde Turkce e-posta govdesi kalmadi", () => {
    expect(uc).not.toContain("Bagajınızı");
    expect(uc).not.toContain("teslim alma zamanınız");
  });

  it("rezervasyonun dili okunuyor, sabit deger degil", () => {
    expect(uc).toMatch(/booking\.locale \?\? DEFAULT_NOTIFICATION_LOCALE/);
  });
});

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { normalizeBookingCode, MIN_BOOKING_CODE_LENGTH } from "@/lib/booking-code";

/**
 * HESAPSIZ MİSAFİRİN REZERVASYONUNU BULMASI.
 *
 * Bu, tezgâhta en kritik yol: misafir anonim rezervasyon yaptı, sekmeyi
 * kapattı, dükkanın önünde QR'ını arıyor. Tıkanırsa valiz teslim edilemez.
 *
 * İKİ HATA ÖLÇÜLDÜ (2026-08-31, yerel veritabanı):
 *
 * 1. Kod ekranda BÜYÜK HARF ("D8A7FF57"), kimlik küçük harf saklı. Postgres'te
 *    `startsWith` harf duyarlı → misafir KENDİ ekranındaki kodu yazınca
 *    "Rezervasyon bulunamadı" alıyordu ve hatayı kendi yazımından ayırt
 *    edemiyordu.
 * 2. `id: bookingId.length > 8 ? bookingId : undefined` — 8 haneli kodda `id`
 *    filtresi TAMAMEN düşüyordu. Sorgu yalnızca e-postaya bakıp o kişinin İLK
 *    rezervasyonunu döndürüyordu; aynı e-postada 48 rezervasyon vardı. Yani
 *    yanlış kod yazan misafire BAŞKA bir rezervasyonun QR'ı veriliyordu.
 */
describe("normalizeBookingCode", () => {
  it("ekrandaki BUYUK HARF kodu kucuge cevirir", () => {
    expect(normalizeBookingCode("D8A7FF57")).toBe("d8a7ff57");
  });

  it("okunarak yazilan bicimleri temizler", () => {
    expect(normalizeBookingCode(" D8A7-FF57 ")).toBe("d8a7ff57");
    expect(normalizeBookingCode("d8a7 ff57")).toBe("d8a7ff57");
  });

  it("bos ve tanimsiz girdide bos dizge doner", () => {
    expect(normalizeBookingCode(null)).toBe("");
    expect(normalizeBookingCode(undefined)).toBe("");
    expect(normalizeBookingCode("   ")).toBe("");
  });

  it("alt sinir cakismayi engelleyecek kadar uzun", () => {
    expect(MIN_BOOKING_CODE_LENGTH).toBeGreaterThanOrEqual(6);
  });
});

/**
 * Yorumlar AYIKLANIR: bu dosyadaki açıklamalar eski hatalı kalıbı birebir
 * anlatıyor (`id: bookingId.length > 8 ? bookingId : undefined`) ve yorumu
 * tarayan bir mandal kendi belgesini hata sanardı. Repodaki diğer mandallar da
 * (`modal-a11y`) aynı sebeple yorumları atıyor.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("lookup ucu", () => {
  const raw = fs.readFileSync("src/app/api/bookings/lookup/route.ts", "utf8");
  const src = stripComments(raw);

  it("id filtresini ASLA dusurmez", () => {
    // `id: <kosul> ? x : undefined` kaliba geri donerse filtre yine duser.
    expect(src).not.toMatch(/id:\s*bookingId\.length/);
    expect(src).not.toMatch(/:\s*undefined,/);
  });

  it("kodu normalize eder ve alt siniri uygular", () => {
    expect(src).toContain("normalizeBookingCode");
    expect(src).toContain("MIN_BOOKING_CODE_LENGTH");
  });

  it("iki eslesmede HICBIRINI acmaz", () => {
    // Yanlis rezervasyonun QR'ini vermek, hic vermemekten kotudur.
    expect(src).toContain("take: 2");
    expect(src).toMatch(/matches\.length === 1/);
  });
});

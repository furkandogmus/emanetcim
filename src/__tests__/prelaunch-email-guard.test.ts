import { describe, it, expect, vi } from "vitest";

/**
 * ADRES DOGRULANMADAN E-POSTA GONDERILMEZ.
 *
 * Gercek veritabaninda olculdu (2026-09-02): talep testi kaydi servis
 * seviyesinde hicbir dogrulama yapmiyordu ve su girdiler hem KAYDEDILIYOR hem
 * de kendilerine "acilinca haber verecegiz" e-postasi GONDERILMEYE
 * CALISILIYORDU --
 *
 *     "duz-metin"           -> kaydedildi, gonderim denendi
 *     ""      (bos)         -> kaydedildi, gonderim denendi
 *     490 karakterlik dize  -> kaydedildi, gonderim denendi
 *     locale: "klingon"     -> oldugu gibi kaydedildi
 *
 * ASIL ZARAR KAYIT KIRLILIGI DEGIL, GONDEREN ITIBARI. Gecersiz adreslere
 * yapilan her deneme bir bounce uretir; bounce orani yukseldiginde saglayici
 * hesabi kisitlar ve o an TUM e-postalar durur -- rezervasyon onaylari,
 * hatirlatmalar, parola sifirlama dahil. Yani bir talep-testi formundaki
 * dogrulama eksigi urunun butun bildirim yolunu riske atiyordu.
 *
 * 268 talep testi noktasi var ve bu form onlarin tek donusum yolu, yani yol
 * gunluk kullanimda.
 */

const { mockPrisma, mockNotify } = vi.hoisted(() => ({
  mockPrisma: {
    shop: { findUnique: vi.fn() },
    prelaunchInterest: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
  },
  mockNotify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
/*
  Servis gercekte `notifyPrelaunchInterestReceived` cagiriyor; ilk yazdigim
  mock yanlis adi tasiyordu ve GECERLI adreslerde test dusuyordu -- yani mock,
  olcmek istedigim yolu kapatmisti.
*/
vi.mock("@/services/NotificationService", () => ({
  notificationService: {
    notifyPrelaunchInterestReceived: mockNotify,
    sendEmail: mockNotify,
  },
}));

const { prelaunchInterestService } = await import("@/services/PrelaunchInterestService");

async function kaydet(email: string, locale?: string) {
  mockPrisma.shop.findUnique.mockResolvedValue({ isPrelaunch: true, name: "Nokta" });
  mockPrisma.prelaunchInterest.findUnique.mockResolvedValue(null);
  mockPrisma.prelaunchInterest.create.mockResolvedValue({ id: "i1" });
  mockPrisma.prelaunchInterest.count.mockResolvedValue(1);
  mockPrisma.prelaunchInterest.create.mockClear();
  return prelaunchInterestService.record({ shopId: "s1", email, locale } as never);
}

describe("talep testi kaydi e-posta kapisi", () => {
  it.each([
    ["adrese benzemeyen metin", "duz-metin"],
    ["bos", ""],
    ["yalnizca bosluk", "   "],
    ["alan adi noktasiz", "kisi@ornek"],
    ["bosluk iceren", "ad soyad@ornek.test"],
    ["320 karakteri asan", "x".repeat(320) + "@ornek.test"],
  ])("%s reddediliyor", async (_ad, email) => {
    const r = await kaydet(email);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_email");
    expect(
      mockPrisma.prelaunchInterest.create,
      "gecersiz adres KAYDEDILMEMELI",
    ).not.toHaveBeenCalled();
  });

  it.each([
    ["normal", "kisi@ornek.test"],
    ["alt alan adi", "kisi@posta.ornek.test"],
    ["artili", "kisi+etiket@ornek.test"],
  ])("%s KABUL ediliyor", async (_ad, email) => {
    const r = await kaydet(email);
    expect(r.ok).toBe(true);
    expect(mockPrisma.prelaunchInterest.create).toHaveBeenCalled();
  });

  it("desteklenmeyen dil `null`a dusuyor", async () => {
    await kaydet("kisi@ornek.test", "klingon");
    const cagri = mockPrisma.prelaunchInterest.create.mock.calls[0][0];
    expect(cagri.data.locale, "taninmayan dil kaydedilmemeli").toBeNull();
  });

  it("desteklenen dil KORUNUYOR", async () => {
    await kaydet("kisi@ornek.test", "de");
    const cagri = mockPrisma.prelaunchInterest.create.mock.calls[0][0];
    expect(cagri.data.locale).toBe("de");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { user: { update: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import { partnerProfileService } from "@/services/PartnerProfileService";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.update.mockResolvedValue({ id: "u1" });
  mockPrisma.user.findUnique.mockResolvedValue({ email: "a@b.co", phone: "5320000000", _count: { accounts: 0 } });
});

/**
 * Telefon güncelleme. Gövde iki taşıyıcının ORTAK yeri; daha önce mobil uç
 * ham değeri doğrudan yazıyordu ve kuralın hiçbirini uygulamıyordu.
 */
describe("esnaf telefon güncelleme", () => {
  it("telefon-only kullanicida eski \"+90...\" kaydi ayni numarayla normal bicimde yazilabilir", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: null, phone: "+905321234567", _count: { accounts: 0 } });
    const res = await partnerProfileService.updatePhone("u1", "0532 123 45 67");
    expect(res).toEqual({ ok: true, phone: "5321234567" });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { phone: "5321234567" } });
  });

  it("eski bicimli kayitta FARKLI numara hala kilitli", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: null, phone: "05321234567", _count: { accounts: 0 } });
    const res = await partnerProfileService.updatePhone("u1", "5559998877");
    expect(res).toEqual({ ok: false, reason: "login_phone_locked" });
  });

  it("TR yerel yazımlarını TEK BİÇİME indirir", async () => {
    /*
      Asil mesele bu. `User.phone` @unique ve `auth.config.ts` telefonla
      giriste "yazilanin aynisi" ve "10 haneli normal bicim" diye iki sey
      deniyor. Alana bosluklu/artili bir dizi yazilirsa esnaf kendi numarasiyla
      giris yapamaz -- ikisi de tutmaz.
    */
    for (const input of ["05321234567", "5321234567", "+905321234567", "0532 123 45 67", "(0532) 123-4567"]) {
      vi.clearAllMocks();
      mockPrisma.user.update.mockResolvedValue({ id: "u1" });
      const res = await partnerProfileService.updatePhone("u1", input);
      expect(res, input).toEqual({ ok: true, phone: "5321234567" });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { phone: "5321234567" },
      });
    }
  });

  it("GEÇERSİZ numarayı reddeder — yazmaz", async () => {
    // Mobil uc bunlari oldugu gibi kaydediyordu; platform elinde bir iletisim
    // numarasi oldugunu saniyordu.
    for (const bad of ["asdf", "123", "0212 555 44 33", "+441234567890"]) {
      vi.clearAllMocks();
      const res = await partnerProfileService.updatePhone("u1", bad);
      expect(res, bad).toEqual({ ok: false, reason: "invalid_tr_phone" });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    }
  });

  it("BOŞ değer silmedir, hata değil", async () => {
    // Mobil uc `if (!phone)` ile 400 donuyordu: numara bir kez girildikten
    // sonra uygulamadan silinemiyordu.
    for (const empty of ["", "   ", null, undefined]) {
      vi.clearAllMocks();
      mockPrisma.user.update.mockResolvedValue({ id: "u1" });
      const res = await partnerProfileService.updatePhone("u1", empty);
      expect(res, String(empty)).toEqual({ ok: true, phone: null });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { phone: null },
      });
    }
  });

  it("başkasına ait numarada AYRI bir sebep döner", async () => {
    // Mobil uc bunu jenerik 500'e dusuruyordu; esnaf "sunucu hatasi" gorup
    // neyi duzeltecegini bilemiyordu.
    mockPrisma.user.update.mockRejectedValue(Object.assign(new Error("x"), { code: "P2002" }));
    const res = await partnerProfileService.updatePhone("u1", "05321234567");
    expect(res).toEqual({ ok: false, reason: "already_registered" });
  });

  it("beklenmeyen veritabanı hatasını YUTMAZ", async () => {
    // Yutmak, yazilmamis bir degeri "kaydedildi" diye gostermek olurdu.
    mockPrisma.user.update.mockRejectedValue(new Error("baglanti koptu"));
    await expect(partnerProfileService.updatePhone("u1", "05321234567")).rejects.toThrow("baglanti koptu");
  });
});

describe("giris numarasi korumasi", () => {
  it("e-postasi ve baska girisi olmayan hesabin numarasi SILINEMEZ ve DEGISTIRILEMEZ", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: null, phone: "5320000000", _count: { accounts: 0 } });
    for (const next of [null, "", "05321234567"]) {
      const res = await partnerProfileService.updatePhone("u1", next);
      expect(res, String(next)).toEqual({ ok: false, reason: "login_phone_locked" });
    }
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("ayni numarayi tekrar kaydetmek engellenmez", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: null, phone: "5321234567", _count: { accounts: 0 } });
    const res = await partnerProfileService.updatePhone("u1", "0532 123 45 67");
    expect(res).toEqual({ ok: true, phone: "5321234567" });
  });

  it("baska giris yontemi varsa (e-posta ya da Google/Apple) degisim serbest", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ email: null, phone: "5320000000", _count: { accounts: 1 } });
    expect(await partnerProfileService.updatePhone("u1", null)).toEqual({ ok: true, phone: null });
  });
});


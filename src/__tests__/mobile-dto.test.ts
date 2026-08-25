import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  toMobileUser,
  toMobileShop,
  toMobileBookingSummary,
  toMobileBookingDetail,
} from "@/lib/mobile-dto";

/**
 * MOBİL GÖVDE BİÇİMLERİ — tek yer.
 *
 * NEDEN (2026-08-25'te ölçüldü): aynı alan-alan eşleme uçlarda ayrı ayrı
 * yazılmıştı ve İKİ yerde zaten ayrışmıştı:
 *
 *   - `isVerified` yalnızca `shops/nearby` yanıtında vardı, `shops/[id]`'de yoktu:
 *     uygulama aynı dükkanı listede "doğrulanmış", detayda doğrulanmamış
 *     gösteriyordu.
 *   - `emailVerified` yalnızca `auth/session` ve `auth/me` yanıtlarında vardı;
 *     Apple/Google/kayıt ile girenler için yoktu — "e-postanı doğrula" uyarısı
 *     hangi yoldan girildiğine göre çıkıyor ya da çıkmıyordu.
 *
 * Bunlar tipik "kopyalar zamanla ayrışır" örneği: kimse bir alanı silmedi,
 * biri EKLENDİ ve diğer kopya geride kaldı.
 */

const USER = {
  id: "u1",
  email: "a@b.com",
  name: "Ada",
  phone: "5551112233",
  role: "GUEST",
  image: "https://x/y.png",
  emailVerified: new Date("2026-01-01"),
};

const SHOP = {
  id: "s1",
  name: "Dükkan",
  address: "Adres",
  city: "İstanbul",
  district: "Kadıköy",
  image: null,
  latitude: 41,
  longitude: 29,
  pricePerDay: 50,
  capacity: 10,
  rating: 4.5,
  openingTime: "09:00",
  closingTime: "20:00",
  open247: false,
  hasRestroom: true,
  isActive: true,
  isVerified: true,
};

const BOOKING = {
  id: "b1",
  shopId: "s1",
  shop: { name: "Dükkan", latitude: 41, longitude: 29, owner: { phone: "555" } },
  checkInTime: new Date("2026-09-01T09:00:00Z"),
  checkOutTime: new Date("2026-09-01T18:00:00Z"),
  bagCountS: 1,
  bagCountM: 2,
  bagCountXl: 0,
  totalPrice: 250,
  status: "PAID",
  qrCodeToken: "qr",
  guest: { name: "Ada" },
  seals: [{ sealNumber: 5, bagIndex: 0, bagSize: "M" }],
};

describe("mobil kullanıcı gövdesi", () => {
  it("`emailVerified`'ı BOOLEAN olarak taşır", () => {
    // Istemcinin ihtiyaci olan tek bilgi bu; tarihin kendisi ise kullanilmiyordu.
    expect(toMobileUser(USER).emailVerified).toBe(true);
    expect(toMobileUser({ ...USER, emailVerified: null }).emailVerified).toBe(false);
  });

  it("parola/hash gibi iç alanları SIZDIRMAZ", () => {
    // Govde ACIK bir alan listesi; `...user` yayilmasi olsaydi yeni bir sutun
    // (ornegin `passwordHash`) sessizce istemciye giderdi.
    const body = toMobileUser({ ...USER, ...({ passwordHash: "gizli" } as object) });
    expect(Object.keys(body).sort()).toEqual(
      ["avatarUrl", "email", "emailVerified", "id", "name", "phone", "role"].sort(),
    );
  });
});

describe("mobil dükkan gövdesi", () => {
  it("`isVerified` HER yanıtta bulunur", () => {
    expect(toMobileShop(SHOP).isVerified).toBe(true);
  });

  it("`Decimal` fiyatı sayıya çevirir", () => {
    const asDecimal = { toNumber: () => 75 };
    expect(toMobileShop({ ...SHOP, pricePerDay: asDecimal }).pricePerDay).toBe(75);
  });

  it("koordinatsız dükkanı kabul eder", () => {
    // Sema `Float?`: heniz haritaya islenmemis dukkan mumkun.
    const body = toMobileShop({ ...SHOP, latitude: null, longitude: null });
    expect(body.latitude).toBeNull();
  });
});

describe("mobil rezervasyon gövdesi", () => {
  it("DETAY, ÖZETİN üst kümesidir", () => {
    // Listede gorunen bir alan detayda da olmali; tersi degil. Iki gövde ayri
    // yazildiginda ilk bozulan sey tam olarak bu iliskiydi.
    const summary = toMobileBookingSummary(BOOKING);
    const detail = toMobileBookingDetail(BOOKING);
    for (const [k, v] of Object.entries(summary)) {
      expect(detail[k as keyof typeof detail], k).toEqual(v);
    }
    expect(Object.keys(detail).length).toBeGreaterThan(Object.keys(summary).length);
  });

  it("özet gövdesi QR ve mühür TAŞIMAZ", () => {
    // Sayfa basina 50 kayit donuyor; QR token'i listede hem gereksiz hem risktir.
    const summary = toMobileBookingSummary(BOOKING) as Record<string, unknown>;
    expect(summary.qrCodeToken).toBeUndefined();
    expect(summary.seals).toBeUndefined();
  });
});

describe("mandal: uçlar kendi gövdesini yazmıyor", () => {
  function mobileRoutes(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) mobileRoutes(p, out);
      else if (e.name === "route.ts") out.push(p);
    }
    return out;
  }

  it("hiçbir uç kullanıcı GÖVDESİNİ elle kurmuyor", () => {
    /*
      Aranan sey tek bir alan degil, GOVDENIN IMZASI: `role` ve `avatarUrl`
      birlikte gecen bir nesne literali. Tek basina `avatarUrl` mesru olabilir —
      avatar yukleme yaniti (`{ success, avatarUrl }`) kullanici govdesi degildir
      ve onu da bastiran bir mandal, gereksiz bir refactor'a ya da kapatilmaya
      yol acar.
    */
    const re = /role:\s*\w[^}]{0,200}avatarUrl:|avatarUrl:[^}]{0,200}role:\s*\w/;
    const offenders = mobileRoutes(path.join(process.cwd(), "src/app/api/mobile"))
      .filter((f) => re.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(process.cwd(), f));
    expect(
      offenders,
      "Kullanıcı gövdesi `toMobileUser()`'da. Bu uçlar kendi kopyasını yazıyor:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});

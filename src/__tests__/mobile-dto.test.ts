import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PRICING_RULES } from "@/lib/pricing-rules";
import {
  toMobileUser,
  toMobileShop,
  toMobilePriceBySize,
  toMobilePricing,
  toMobileBookingSummary,
  toMobileBookingDetail,
  toMobilePartnerShop,
  toMobileSealRequest,
  toMobileAppConfig,
  isBookingExpired,
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
  passwordHash: null as string | null,
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
  hasCctv: true,
  hasClimateControl: false,
  acceptsLargeItems: true,
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
    const body = toMobileUser({ ...USER, passwordHash: "gizli" });
    expect(Object.keys(body).sort()).toEqual(
      ["avatarUrl", "email", "emailVerified", "hasPassword", "id", "name", "phone", "role"].sort(),
    );
    expect(JSON.stringify(body)).not.toContain("gizli");
  });

  it("`hasPassword` yalnızca var/yok bilgisidir", () => {
    expect(toMobileUser(USER).hasPassword).toBe(false);
    expect(toMobileUser({ ...USER, passwordHash: "x" }).hasPassword).toBe(true);
  });
});

describe("mobil dükkan gövdesi", () => {
  it("`isVerified` HER yanıtta bulunur", () => {
    expect(toMobileShop(SHOP).isVerified).toBe(true);
  });

  it("olanak alanları (rozet + süzgeç) taşınır", () => {
    expect(toMobileShop(SHOP)).toMatchObject({ hasCctv: true, hasClimateControl: false, acceptsLargeItems: true });
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

describe("suresi dolan rezervasyon (expired)", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const past = new Date("2026-11-21T10:00:00Z");
  const future = new Date("2026-11-21T14:00:00Z");

  it("onayli/odenmis, valiz birakilmamis ve alma saati gecmisse dolmustur", () => {
    expect(isBookingExpired({ status: "APPROVED", checkOutTime: past }, now)).toBe(true);
    expect(isBookingExpired({ status: "PAID", checkOutTime: past }, now)).toBe(true);
  });

  it("bekleyen ve onay bekleyen kayit da alma saati gecince dolmustur", () => {
    expect(isBookingExpired({ status: "PENDING", checkOutTime: past }, now)).toBe(true);
    expect(isBookingExpired({ status: "WAITING_APPROVAL", checkOutTime: past }, now)).toBe(true);
    expect(isBookingExpired({ status: "WAITING_APPROVAL", checkOutTime: future }, now)).toBe(false);
  });

  it("alma saati gelmediyse dolmamistir", () => {
    expect(isBookingExpired({ status: "APPROVED", checkOutTime: future }, now)).toBe(false);
  });

  it("valiz dukkandaysa (CHECKED_IN) gec kalsa da dolmus sayilmaz: QR gerekli", () => {
    expect(isBookingExpired({ status: "CHECKED_IN", checkOutTime: past }, now)).toBe(false);
  });

  it("iptal ve tamamlanmis kayit 'dolmus' degildir", () => {
    expect(isBookingExpired({ status: "CANCELLED", checkOutTime: past }, now)).toBe(false);
    expect(isBookingExpired({ status: "CHECKED_OUT", checkOutTime: past }, now)).toBe(false);
  });

  it("ozet govdesi `expired` alanini tasir", () => {
    const old = { ...BOOKING, status: "APPROVED", checkOutTime: new Date("2020-01-01T00:00:00Z") };
    expect(toMobileBookingSummary(old).expired).toBe(true);
    expect(toMobileBookingDetail(old).expired).toBe(true);
  });
});

describe("mobil uygulama yapilandirmasi: odeme kipi", () => {
  const base = { minAppVersion: null, latestAppVersion: null };

  it("kip verilmezse ya da bilinmiyorsa dukkanda tahsilat (onsite)", () => {
    expect(toMobileAppConfig(base).paymentMode).toBe("onsite");
    expect(toMobileAppConfig({ ...base, paymentMode: "bogus" as never }).paymentMode).toBe("onsite");
  });

  it("online kip aynen gecer", () => {
    expect(toMobileAppConfig({ ...base, paymentMode: "online" }).paymentMode).toBe("online");
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

describe("toMobilePricing", () => {
  it("odeme tahmini icin carpanlari ve sigortayi sunucu kuralindan tasir", () => {
    // Canlidaki satir: carpanlar 1/1/1, sigorta 0. Istemci sabit 0.8/1.5 ve ₺15
    // yazdigi icin misafire yanlis tutar gosteriyordu.
    const rules = {
      ...DEFAULT_PRICING_RULES,
      bagMultipliers: { S: 1, M: 1, XL: 1 },
      insuranceFeeTry: 0,
    };
    expect(toMobilePricing(rules)).toEqual({
      bagMultiplierS: 1,
      bagMultiplierM: 1,
      bagMultiplierXl: 1,
      insuranceFeeTry: 0,
    });
  });
});

describe("toMobilePriceBySize", () => {
  it("boyut basina fiyati sunucu yuvarlamasiyla verir (float gurultusu yok)", () => {
    const rules = { ...DEFAULT_PRICING_RULES, bagMultipliers: { S: 0.7, M: 1, XL: 1.1 } };
    expect(toMobilePriceBySize(110, rules)).toEqual({ s: 77, m: 110, xl: 121 });
  });
});

describe("toMobileShop: haftalik takvim", () => {
  it("takvim verilmezse alanlar yanita girmez (liste yaniti sismez)", () => {
    const body = toMobileShop(SHOP);
    expect(body).not.toHaveProperty("weeklyHours");
    expect(body).not.toHaveProperty("closures");
  });

  it("takvim verilirse haftalik saat ve izinler tasinir", () => {
    const body = toMobileShop(SHOP, {
      weekly: [{ weekday: 7, isClosed: true, openingTime: "09:00", closingTime: "20:00" }],
      closures: [{ startDate: "2030-01-14", endDate: "2030-01-15" }],
    });
    expect(body.weeklyHours).toEqual([
      { weekday: 7, isClosed: true, openingTime: "09:00", closingTime: "20:00" },
    ]);
    expect(body.closures).toEqual([{ startDate: "2030-01-14", endDate: "2030-01-15" }]);
  });
});

describe("toMobileSealRequest", () => {
  it("teslim onayi icin `id`yi ve tarihi ISO metin olarak tasir, `requestedBy` sizmaz", () => {
    const row = {
      id: "r1",
      quantity: 20,
      status: "SHIPPED",
      trackingNumber: "TR123",
      serialFrom: 101,
      serialTo: 120,
      adminNote: null,
      autoGenerated: false,
      createdAt: new Date("2026-10-01T10:00:00Z"),
      requestedBy: "u1",
    };
    const body = toMobileSealRequest(row) as Record<string, unknown>;
    expect(body.id).toBe("r1");
    expect(body.createdAt).toBe("2026-10-01T10:00:00.000Z");
    expect(body.requestedBy).toBeUndefined();
  });
});

describe("misafir telefonu (detay gövdesi)", () => {
  const withPhone = { ...BOOKING, guest: { name: "Ada", phone: "5551112233" } };
  it("yalnız esnaf/yönetici için ve aktif kayıtta çıkar", () => {
    expect(toMobileBookingDetail(withPhone, { operator: true }).guestPhone).toBe("5551112233");
    expect(toMobileBookingDetail(withPhone).guestPhone).toBe("");
    expect(toMobileBookingDetail({ ...withPhone, status: "CHECKED_OUT" }, { operator: true }).guestPhone).toBe("");
    expect(toMobileBookingDetail({ ...withPhone, status: "CANCELLED" }, { operator: true }).guestPhone).toBe("");
  });
  it("hesapsız misafirde rezervasyondaki numaraya düşer", () => {
    expect(toMobileBookingDetail({ ...BOOKING, guest: null, guestPhone: "5320000000" }, { operator: true }).guestPhone).toBe("5320000000");
  });
});

describe("itiraz durumu ve bekleyen valiz önerisi (detay gövdesi)", () => {
  const PENDING = { bagCountS: 1, bagCountM: 2, bagCountXl: 0, extraAmount: 50, newTotal: 300 };

  // Bulgu 52: kart "inceliyoruz"da takılı kalıyordu; sonuç misafire görünmeli.
  it("itiraz durumunu taşır; bilinmeyen değer OPEN, itiraz yoksa null", () => {
    expect(toMobileBookingDetail(BOOKING).disputeStatus).toBeNull();
    expect(toMobileBookingDetail({ ...BOOKING, dispute: { id: "d1", status: "RESOLVED" } }).disputeStatus).toBe("RESOLVED");
    expect(toMobileBookingDetail({ ...BOOKING, dispute: { id: "d1", status: "CLOSED" } }).disputeStatus).toBe("CLOSED");
    expect(toMobileBookingDetail({ ...BOOKING, dispute: { id: "d1", status: "WEIRD" } }).disputeStatus).toBe("OPEN");
    expect(toMobileBookingDetail({ ...BOOKING, dispute: { id: "d1" } }).disputeStatus).toBe("OPEN");
  });

  // Bulgu 57: iptal edilmiş kayıtta kalan öneri onaylanamayacak bir kart çizdiriyordu.
  it("öneriyi yalnızca düzeltilebilir durumda gösterir", () => {
    for (const status of ["APPROVED", "PAID", "CHECKED_IN"]) {
      expect(toMobileBookingDetail({ ...BOOKING, status, pendingBagRevision: PENDING }).pendingBagRevision).toEqual(PENDING);
    }
    for (const status of ["CANCELLED", "CHECKED_OUT"]) {
      expect(toMobileBookingDetail({ ...BOOKING, status, pendingBagRevision: PENDING }).pendingBagRevision).toBeNull();
    }
  });
});

describe("esnaf dükkan gövdesi", () => {
  const FULL = {
    ...SHOP,
    ownerId: "u9",
    isTest: false,
    timezone: "Europe/Istanbul",
    pricePerDay: { toNumber: () => 75 },
    open247: false,
  };
  it("açık alan listesi: ownerId, isTest, timezone SIZMAZ", () => {
    const body = toMobilePartnerShop(FULL) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ["address", "capacity", "city", "closingTime", "district", "id", "image", "name", "open247", "openingTime", "pricePerDay"].sort(),
    );
  });
  it("Decimal fiyat sayı olur", () => {
    expect(toMobilePartnerShop(FULL).pricePerDay).toBe(75);
  });
  it("rota `...shop` yayılımı kullanmaz", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/app/api/mobile/partner/shop/route.ts", "utf8");
    expect(src).not.toMatch(/(^|[{,])\s*\.\.\.shop\s*[,}]?\s*$/m);
  });
});

describe("toMobileBookingDetail: gec birakma alanlari", () => {
  it("valiz birakilmadiysa lateCloseAt = birakma + 60 dk, bekletme varsa onun sonu", () => {
    expect(toMobileBookingDetail(BOOKING)).toMatchObject({ lateCloseAt: "2026-09-01T10:00:00.000Z", lateHoldUntil: null });
    const held = toMobileBookingDetail({ ...BOOKING, lateHoldUntil: new Date("2026-09-01T10:30:00Z") });
    expect(held).toMatchObject({ lateCloseAt: "2026-09-01T10:30:00.000Z", lateHoldUntil: "2026-09-01T10:30:00.000Z" });
  });

  it("valiz birakildiysa ya da kapandiysa lateCloseAt null", () => {
    expect(toMobileBookingDetail({ ...BOOKING, checkedInAt: new Date("2026-09-01T09:10:00Z") }).lateCloseAt).toBeNull();
    expect(toMobileBookingDetail({ ...BOOKING, status: "CHECKED_IN" }).lateCloseAt).toBeNull();
    expect(toMobileBookingDetail({ ...BOOKING, status: "CANCELLED" }).lateCloseAt).toBeNull();
  });
});

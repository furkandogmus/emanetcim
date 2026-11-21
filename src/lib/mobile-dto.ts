import { moneyToNumber } from "@/lib/money";
import { stripHtmlToText } from "@/lib/rich-text";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import type { PricingRules } from "@/lib/pricing-rules";
import { shopVisibilityIssues } from "@/lib/shop-visibility";
import { storageCitiesListingShop } from "@/lib/storage-cities";
import { isBagRevisableStatus } from "@/lib/bag-revision-status";
import type { PartnerDashboardSnapshot } from "@/services/PartnerDashboardService";

/**
 * Adres + semt + il; adreste zaten gecen parca tekrar eklenmez. Esnaf adresi cogu zaman
 * "..., Beyoglu, Istanbul" diye yaziyor ve ekranda "Beyoglu, Istanbul" iki kez cikiyordu.
 */
export function fullAddress(
  address: string | null | undefined,
  district: string | null | undefined,
  city: string | null | undefined,
): string {
  const base = (address ?? "").trim();
  const has = (part: string) => base.toLocaleLowerCase("tr").includes(part.trim().toLocaleLowerCase("tr"));
  return [base, ...[district, city].filter((p): p is string => !!p && !!p.trim() && !has(p))]
    .filter(Boolean)
    .join(", ");
}

/**
 * Mobil istemciye giden GÖVDE biçimleri — tek yer.
 *
 * NEDEN VAR (2026-08-25'te ölçüldü): aynı alan-alan eşleme iki uçta ayrı ayrı
 * yazılmıştı (`bookings/me` ↔ `bookings/[id]`, `shops/nearby` ↔ `shops/[id]`).
 * Henüz ayrışmamışlardı ama **ayrışma zaten başlamıştı**: `isVerified` yalnızca
 * `shops/nearby` yanıtında vardı, detay yanıtında yoktu — yani mobil uygulama
 * liste ekranında "doğrulanmış esnaf" rozetini çizebiliyor, detay ekranında
 * çizemiyordu. Aynı dükkan, iki ekranda iki farklı gerçek.
 *
 * Alan EKLEMEK artık tek dosyayı değiştirmek demek; bir ucun geride kalması için
 * bir yüzey kalmıyor.
 *
 * ÖZET / DETAY ayrımı bilinçli: liste yanıtı küçük kalmalı (sayfa başına 50
 * kayıt), detay yanıtı QR, mühür ve konum taşır. Detay, özetin ÜST KÜMESİDİR —
 * yani listede görünen bir alan detayda da vardır, tersi değil.
 */

/** Prisma `Decimal` alanları istemciye sayı olarak çıkar (proje kuralı). */
type BookingSummarySource = {
  id: string;
  shopId: string;
  shop: { name: string };
  checkInTime: Date;
  checkOutTime: Date;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  totalPrice: unknown;
  status: string;
};

export function toMobileBookingSummary(b: BookingSummarySource) {
  return {
    id: b.id,
    shopId: b.shopId,
    shopName: b.shop.name,
    checkInTime: b.checkInTime,
    checkOutTime: b.checkOutTime,
    bagCountS: b.bagCountS,
    bagCountM: b.bagCountM,
    bagCountXl: b.bagCountXl,
    totalPrice: moneyToNumber(b.totalPrice),
    status: b.status,
  };
}

type BookingDetailSource = BookingSummarySource & {
  qrCodeToken: string | null;
  guest: { name: string | null; phone?: string | null } | null;
  guestPhone?: string | null;
  shop: {
    name: string;
    /* Sema `Float?`: koordinatsiz dukkan (henuz haritaya islenmemis) mumkun. */
    latitude: number | null;
    longitude: number | null;
    address?: string | null;
    district?: string | null;
    city?: string | null;
    owner: { phone: string | null };
  };
  seals: Array<{ sealNumber: number; bagIndex: number; bagSize: string }>;
  review?: { id: string } | null;
  dispute?: { id: string } | null;
  pendingBagRevision?: unknown;
};

/**
 * Esnafin onerdigi, misafir onayi bekleyen valiz duzeltmesi. Kayit JSON
 * (`persistPendingRevision`); bozuk ya da eksikse `null` -- istemci karti hic cizmez.
 */
function toMobilePendingBagRevision(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const n = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : null);
  const s = n("bagCountS"), m = n("bagCountM"), xl = n("bagCountXl");
  const extra = n("extraAmount"), next = n("newTotal");
  if (s == null || m == null || xl == null || extra == null || next == null) return null;
  return { bagCountS: s, bagCountM: m, bagCountXl: xl, extraAmount: extra, newTotal: next };
}

export function toMobileBookingDetail(b: BookingDetailSource, opts: { operator?: boolean } = {}) {
  /*
    Misafirin telefonu YALNIZCA islemi yapan esnaf/yonetici icin ve YALNIZCA
    aktif rezervasyonda (gelmeyen/gec kalan misafiri aramak icin). Kural burada,
    DTO'da: rota ayri bir kopya tutarsa ayrisir. Bitmis kayitta bos doner.
  */
  const active = !["CHECKED_OUT", "CANCELLED"].includes(b.status);
  const guestPhone = opts.operator && active ? (b.guest?.phone ?? b.guestPhone ?? "") : "";
  return {
    ...toMobileBookingSummary(b),
    qrCodeToken: b.qrCodeToken,
    guestName: b.guest?.name ?? "",
    latitude: b.shop.latitude,
    longitude: b.shop.longitude,
    shopPhone: b.shop.owner.phone ?? "",
    // Turist taksiciye gosterebilsin; koordinatsiz dukkanda yol tarifi de buradan.
    shopAddress: fullAddress(b.shop.address, b.shop.district, b.shop.city),
    seals: b.seals.map((s) => ({
      sealNumber: s.sealNumber,
      bagIndex: s.bagIndex,
      bagSize: s.bagSize,
    })),
    // Istemci "degerlendir" / "sorun bildir" dugmesini buna gore gizler; once
    // yalnizca sunucunun 409'uyla ogreniyordu.
    hasReview: !!b.review,
    hasDispute: !!b.dispute,
    /*
      Yalnizca duzeltilebilir durumda: iptal edilmis/teslim edilmis rezervasyonda
      kalmis bir oneri misafire onaylayamayacagi bir kart cizdiriyordu (bulgu 57).
    */
    pendingBagRevision: isBagRevisableStatus(b.status)
      ? toMobilePendingBagRevision(b.pendingBagRevision)
      : null,
    guestPhone,
  };
}

type ShopSummarySource = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  pricePerDay: unknown;
  capacity: number;
  rating: number | null;
  openingTime: string | null;
  closingTime: string | null;
  open247: boolean;
  hasRestroom: boolean;
  isActive: boolean;
  isVerified: boolean;
  isPrelaunch?: boolean;
};

/**
 * Dükkan gövdesi. `isVerified` HER İKİ uçta da bulunur: güven rozeti ürünün
 * temel vaadi, listede gösterip detayda gizlemek tutarsızdı.
 *
 * `isPrelaunch` de aynı sebeple burada: 2026-08-31'de arama, talep testi
 * noktalarını da döndürmeye başladı (`findShopsForSearch`) ve `/mobile/shops/
 * nearby` aynı servisi kullanıyor. Bayrak taşınmazsa mobil istemci bu noktayı
 * normal bir dükkandan AYIRT EDEMEZ: ₺250 (şema varsayılanı, gerçek fiyat değil)
 * ve "Rezervasyon yap" gösterir, misafir dener ve sunucudan `409
 * shop_not_open_yet` yer. Sunucu kapısı sağlam, ama misafire tutamayacağımız
 * sözü verdikten sonra reddetmek kapının işi değil — arayüzün işi.
 */
export type MobileSchedule = {
  weekly: { weekday: number; isClosed: boolean; openingTime: string; closingTime: string }[];
  closures: { startDate: string; endDate: string }[];
};

export function toMobileShop(s: ShopSummarySource, schedule?: MobileSchedule) {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    city: s.city,
    district: s.district,
    image: s.image,
    latitude: s.latitude,
    longitude: s.longitude,
    pricePerDay: moneyToNumber(s.pricePerDay),
    capacity: s.capacity,
    rating: s.rating,
    openingTime: s.openingTime,
    closingTime: s.closingTime,
    open247: s.open247,
    hasRestroom: s.hasRestroom,
    isActive: s.isActive,
    isVerified: s.isVerified,
    isPrelaunch: s.isPrelaunch ?? false,
    ...(schedule
      ? {
          weeklyHours: schedule.weekly.map((w) => ({
            weekday: w.weekday,
            isClosed: w.isClosed,
            openingTime: w.openingTime,
            closingTime: w.closingTime,
          })),
          closures: schedule.closures.map((c) => ({ startDate: c.startDate, endDate: c.endDate })),
        }
      : {}),
  };
}

/**
 * Mobil ödeme ekranının TAHMİNİ tutarı hesaplarken kullandığı kurallar.
 *
 * NEDEN (2026-09-23): istemci çarpanları (0.8/1.0/1.5) ve sigortayı (₺15) sabit
 * yazıyordu. Canlıda çarpanlar 1/1/1, sigorta 0 — misafir S için ₺120, XL için
 * ₺225 ve ayrıca ₺15 sigorta görüyor, sunucu ise hepsine ₺150 kesiyordu. Aradaki
 * fark yalnızca geliştirici loguna düşüyordu. Kural sunucuda; istemci onu okur.
 */
/**
 * Liste ve haritada gosterilen gunluk fiyat ARALIGI (en kucuk - en buyuk valiz).
 * `pricePerDay` orta valizin taban fiyati; tek basina "valiz basi ₺250" diye
 * gosterilince kucuk/buyuk valizin farkli fiyati ayni ekranda celisiyordu.
 */
export function toMobilePriceRange(pricePerDay: unknown, r: PricingRules) {
  const base = moneyToNumber(pricePerDay);
  const m = [r.bagMultipliers.S, r.bagMultipliers.M, r.bagMultipliers.XL];
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    min: round(base * Math.min(...m)),
    max: round(base * Math.max(...m)),
    // Liste ve pinde gosterilen tek fiyat: orta boy valizin gunlugu (2026-11-19, aralik
    // kartin yarisini kapliyor ve dukkan adini kesiyordu).
    medium: round(base * r.bagMultipliers.M),
  };
}

/**
 * Dukkan detayinda boyut basina gunluk fiyat, sunucunun yuvarlamasiyla. Istemci
 * `pricePerDay * carpan` hesaplamaz (mobile-expo/CLAUDE.md "Fiyat istemcide hesaplanmaz").
 */
export function toMobilePriceBySize(pricePerDay: unknown, r: PricingRules) {
  const base = moneyToNumber(pricePerDay);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    s: round(base * r.bagMultipliers.S),
    m: round(base * r.bagMultipliers.M),
    xl: round(base * r.bagMultipliers.XL),
  };
}

export function toMobilePricing(r: PricingRules) {
  return {
    bagMultiplierS: r.bagMultipliers.S,
    bagMultiplierM: r.bagMultipliers.M,
    bagMultiplierXl: r.bagMultipliers.XL,
    insuranceFeeTry: r.insuranceFeeTry,
  };
}

type MobileUserSource = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: string;
  image: string | null;
  emailVerified: Date | null;
  /** Yalnızca "var mı" bilgisi dışarı çıkar; hash asla. Select'te `passwordHash: true` şart. */
  passwordHash: string | null;
};

/**
 * Mobil istemciye giden KULLANICI gövdesi.
 *
 * NEDEN ORTAK (2026-08-25'te ölçüldü): beş uç bunu ayrı ayrı yazıyordu
 * (`apple`, `google`, `register`, `session`, `me`) ve **zaten ayrışmıştı**:
 * `emailVerified` yalnızca `session` ve `me` yanıtlarında vardı. Yani Apple veya
 * Google ile giren bir kullanıcı için uygulama e-postanın doğrulanıp
 * doğrulanmadığını BİLMİYORDU — "e-postanı doğrula" uyarısı hangi yoldan
 * girdiğine göre çıkıyor ya da çıkmıyordu.
 *
 * `emailVerified` tarih DEĞİL boolean olarak çıkar: istemcinin ihtiyacı olan tek
 * bilgi bu ve tarihin kendisi hesap sahibinin işine yaramıyor.
 */
export function toMobileUser(u: MobileUserSource) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    avatarUrl: u.image,
    emailVerified: u.emailVerified !== null,
    hasPassword: u.passwordHash !== null,
  };
}

type ReviewSource = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  guest: { name: string | null };
};

/**
 * Dükkan yorumu. `authorLabel` yalnızca ilk ad — web `shop/[shopId]` sayfasıyla
 * aynı gizlilik kuralı: misafirin tam adı ya da fotoğrafı yorum listesinde
 * görünmez.
 */
export function toMobileReview(r: ReviewSource) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    authorLabel: r.guest.name?.trim()?.split(/\s+/)[0] ?? "",
  };
}

type AppConfigSource = {
  minAppVersion: string | null;
  latestAppVersion: string | null;
  /** Yonetici ayari: check-in'de muhur numarasi zorunlu mu. Gizli degil. */
  requireSealsOnCheckIn?: boolean;
};

/**
 * Uzaktan yapilandirma: degerlendirilmis { anahtar: acik/kapali } haritasi.
 * `/api/mobile/feature-flags`'in tek yaziciysi.
 */
export function toMobileFeatureFlags(flags: Record<string, boolean>) {
  return { flags };
}

/**
 * Uygulama acilis kontrolu: zorunlu/opsiyonel guncelleme kapisi.
 * `/api/mobile/config`'in tek yaziciysi.
 */
export function toMobileAppConfig(c: AppConfigSource) {
  return {
    minAppVersion: c.minAppVersion,
    latestAppVersion: c.latestAppVersion,
    requireSealsOnCheckIn: c.requireSealsOnCheckIn === true,
  };
}

type MobileDeviceSource = {
  token: string;
  platform: string;
  appVersion: string | null;
  locale: string | null;
  lastSeenAt: Date;
};

/**
 * "Bildirim alan cihazlar" ekranının gövdesi. `token` alanı yalnızca geri
 * kaldırma çağrısı (`DELETE /api/mobile/push/register`) için taşınır;
 * EKRANDA `tokenSuffix` (son 6 karakter) gösterilir, ham token'ın tamamı
 * kullanıcıya BASILMAZ — kendi hesabına ait veri olsa da uzun opak bir
 * push token'ı ekranda göstermenin kullanıcıya hiçbir faydası yok.
 */
export function toMobileDevice(d: MobileDeviceSource) {
  return {
    token: d.token,
    tokenSuffix: d.token.slice(-6),
    platform: d.platform,
    appVersion: d.appVersion,
    locale: d.locale,
    lastSeenAt: d.lastSeenAt,
  };
}

type AdminApplicationSource = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  pricePerDay: unknown;
  capacity: number;
  createdAt: Date;
  owner: { name: string | null; phone: string | null; email: string | null };
};

/**
 * Admin basvuru listesi. Uc ham Prisma `Shop` donuyordu: butun kolonlar ve
 * `Decimal` fiyat string olarak. Alan adlari Flutter'in okuduklariyla ayni
 * (`id`, `name`, `address`, `owner.name/phone`) -- eski surum de calismali.
 * Koordinat onay icin gerekli: konumsuz basvuru `missing_coordinates` alir.
 */
export function toMobileAdminApplication(s: AdminApplicationSource) {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    city: s.city,
    district: s.district,
    hasCoordinates: s.latitude != null && s.longitude != null,
    pricePerDay: moneyToNumber(s.pricePerDay),
    capacity: s.capacity,
    createdAt: s.createdAt.toISOString(),
    owner: {
      name: s.owner.name,
      phone: s.owner.phone,
      email: s.owner.email,
      whatsapp: toWhatsAppNumber(s.owner.phone),
    },
  };
}

type GeocodedPlaceSource = { lat: number; lng: number; label: string };

/**
 * Adres arama sonucu. Alan adlari istemcinin `Place` tipiyle ayni
 * (`latitude`/`longitude`), sonuc dogrudan secilebilsin diye.
 * `/api/mobile/geocode`in tek yaziciysi.
 */
export function toMobileGeocodeResult(p: GeocodedPlaceSource) {
  return { label: p.label, latitude: p.lat, longitude: p.lng };
}

type SealRequestSource = {
  id: string;
  quantity: number;
  status: string;
  trackingNumber: string | null;
  serialFrom: number | null;
  serialTo: number | null;
  adminNote: string | null;
  autoGenerated: boolean;
  createdAt: Date;
};

/**
 * Esnafin muhur talebi satiri. Mobilde talep listesi yoktu, bu yuzden
 * `partner/seals/confirm-delivery`nin istedigi `requestId`ye ulasilamiyordu.
 */
export function toMobileSealRequest(r: SealRequestSource) {
  return {
    id: r.id,
    quantity: r.quantity,
    status: r.status,
    trackingNumber: r.trackingNumber,
    serialFrom: r.serialFrom,
    serialTo: r.serialTo,
    adminNote: r.adminNote,
    autoGenerated: r.autoGenerated,
    createdAt: r.createdAt.toISOString(),
  };
}

type PartnerDashboardSource = Pick<
  PartnerDashboardSnapshot,
  "todayArrivals" | "todayPickups" | "bagsInStorage" | "monthNet" | "prevMonthNet" | "monthChangePct"
>;
type ShopRef = { id: string; name: string; isActive?: boolean };

/**
 * Esnafin gunluk dukkan ozeti. Web panelinin "gunluk enstantane" blogu ile ayni
 * servis (`partnerDashboardService.getSnapshot`); mobil ana ekran yalnizca
 * rezervasyon listesiydi.
 */
export function toMobilePartnerDashboard(s: PartnerDashboardSource, shop: ShopRef, shops: ShopRef[]) {
  return {
    /** Ozetin ait oldugu dukkan; cok dukkanli esnafta kart hangisi oldugunu soyler. */
    shop: { id: shop.id, name: shop.name },
    shops: shops.map((x) => ({ id: x.id, name: x.name, isActive: x.isActive ?? true })),
    todayArrivals: s.todayArrivals,
    todayPickups: s.todayPickups,
    bagsInStorage: s.bagsInStorage,
    monthNet: s.monthNet,
    prevMonthNet: s.prevMonthNet,
    monthChangePct: s.monthChangePct,
  };
}

type AdminOverviewSource = Awaited<ReturnType<import("@/services/AdminOverviewService").AdminOverviewService["overview"]>>;

/** `admin/overview`. Son rezervasyonlar ozet DTO'sunu tasir; misafir adi yoksa e-posta. */
type AppUsersSource = Awaited<
  ReturnType<(typeof import("@/services/MobileInstallService"))["mobileInstallService"]["activeCounts"]>
>;

export function toMobileAdminOverview(o: AdminOverviewSource, appUsers: AppUsersSource) {
  return {
    series: o.series,
    today: o.today,
    attention: o.attention,
    totals: o.totals,
    /** Uygulamayi acan tekil kisi (`MobileInstall`), kayan 1/7/30 gun. */
    appUsers: {
      day: appUsers.day,
      week: appUsers.week,
      month: appUsers.month,
      total: appUsers.total,
      signedInMonth: appUsers.signedInMonth,
    },
    recent: o.recent.map((b) => ({
      ...toMobileBookingSummary(b),
      guestName: b.guest?.name || b.guestEmail || "",
      createdAt: b.createdAt.toISOString(),
    })),
  };
}

type AdminOps = import("@/services/AdminOpsService").AdminOpsService;
type AdminBookingRowSource = Awaited<ReturnType<AdminOps["listBookings"]>>[number];
type AdminBookingDetailSource = NonNullable<Awaited<ReturnType<AdminOps["bookingDetail"]>>>;
type AdminShopSource = Awaited<ReturnType<AdminOps["shopsOccupancy"]>>[number];
type AdminShopDetailSource = NonNullable<Awaited<ReturnType<AdminOps["shopDetail"]>>>;
type AdminUserSource = Awaited<
  ReturnType<import("@/services/AdminUserService").AdminUserService["search"]>
>[number];

/** Gorunurluk sorunlari ve listelendigi sehir sayfalari (web admin ile ayni kural). */
function adminShopVisibility(s: {
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  image: string | null;
  isActive: boolean;
  isPrelaunch: boolean;
}) {
  const cityPages = storageCitiesListingShop(s);
  return { cityPages, issues: shopVisibilityIssues({ ...s, cityPages }) };
}

/** "Bu kullanici olarak gor" yalniz ADMIN olmayan, yasaksiz hesap icin mumkun (sunucu kurali). */
export function canViewAs(u: { role: string; isBanned: boolean }): boolean {
  return u.role !== "ADMIN" && !u.isBanned;
}

/** `admin/bookings` satiri: ozet + misafir adi (yoksa e-posta) ve olusturulma ani. */
export function toMobileAdminBookingRow(b: AdminBookingRowSource) {
  return {
    ...toMobileBookingSummary(b),
    guestName: b.guest?.name || b.guest?.email || b.guestEmail || "",
    createdAt: b.createdAt.toISOString(),
  };
}

/** `admin/bookings/[id]`: destek hattinda gereken her sey; QR token'i TASIMAZ. */
export function toMobileAdminBookingDetail({ booking: b, events }: AdminBookingDetailSource) {
  const place = fullAddress(b.shop.address, b.shop.district, b.shop.city);
  return {
    ...toMobileAdminBookingRow(b),
    guest: {
      // Kayitli kullanici degilse (misafir e-postasiyla alinmis) kimlik yok: "bu kullanici olarak gir" cizilmez.
      id: b.guest?.id ?? null,
      name: b.guest?.name ?? "",
      email: b.guest?.email ?? b.guestEmail ?? "",
      phone: b.guest?.phone ?? b.guestPhone ?? "",
      whatsapp: toWhatsAppNumber(b.guest?.phone ?? b.guestPhone),
      // Sunucu ADMIN ve yasakli hesaba girisi reddeder; dugme hic cizilmesin.
      canViewAs: b.guest ? canViewAs(b.guest) : false,
    },
    shop: {
      id: b.shopId,
      ownerId: b.shop.owner.id,
      name: b.shop.name,
      address: place,
      phone: b.shop.owner.phone ?? "",
      whatsapp: toWhatsAppNumber(b.shop.owner.phone),
      ownerName: b.shop.owner.name ?? "",
      canViewAsOwner: canViewAs(b.shop.owner),
      latitude: b.shop.latitude,
      longitude: b.shop.longitude,
    },
    seals: b.seals,
    checkedInAt: b.checkedInAt?.toISOString() ?? null,
    checkedOutAt: b.checkedOutAt?.toISOString() ?? null,
    couponCode: b.couponCode,
    disputeStatus: b.dispute?.status ?? null,
    paymentStatus: b.paymentLog?.status ?? null,
    events: events.map((e) => ({ event: e.event, actorRole: e.actorRole, createdAt: e.createdAt.toISOString() })),
  };
}

/** `admin/shops`: doluluk listesi satiri. */
export function toMobileAdminShop(s: AdminShopSource) {
  return {
    id: s.id,
    name: s.name,
    place: [s.district, s.city].filter(Boolean).join(", "),
    capacity: s.capacity,
    rating: s.rating,
    isPrelaunch: s.isPrelaunch,
    isActive: s.isActive,
    isTest: s.isTest,
    isVerified: s.isVerified,
    issues: s.isPrelaunch || s.isTest ? [] : adminShopVisibility(s).issues,
    phone: s.owner.phone ?? "",
    whatsapp: toWhatsAppNumber(s.owner.phone),
    bagsInStorage: s.bagsInStorage,
    arrivalsToday: s.arrivalsToday,
    pickupsToday: s.pickupsToday,
  };
}

/** `admin/shops/[id]`: dukkan karti; duzenlenebilir alanlar ve son bes rezervasyon. */
export function toMobileAdminShopDetail(d: AdminShopDetailSource) {
  const s = d.shop;
  const { cityPages, issues } = adminShopVisibility(s);
  return {
    id: s.id,
    name: s.name,
    address: s.address ?? "",
    place: [s.district, s.city].filter(Boolean).join(", "),
    capacity: s.capacity,
    rating: s.rating ?? 0,
    pricePerDay: moneyToNumber(s.pricePerDay),
    isActive: s.isActive,
    isTest: s.isTest,
    isVerified: s.isVerified,
    isPrelaunch: s.isPrelaunch,
    hasPhoto: Boolean(s.image),
    latitude: s.latitude,
    longitude: s.longitude,
    hours: s.open247 ? null : { open: s.openingTime ?? "", close: s.closingTime ?? "" },
    createdAt: s.createdAt.toISOString(),
    owner: {
      id: s.owner.id,
      name: s.owner.name ?? "",
      email: s.owner.email ?? "",
      phone: s.owner.phone ?? "",
      whatsapp: toWhatsAppNumber(s.owner.phone),
      canViewAs: canViewAs(s.owner),
    },
    bookingCount: s._count.bookings,
    reviewCount: s._count.reviews,
    bagsInStorage: d.bagsInStorage,
    arrivalsToday: d.arrivalsToday,
    pickupsToday: d.pickupsToday,
    cityPages,
    issues: s.isPrelaunch || s.isTest ? [] : issues,
    recent: d.recent.map(toMobileAdminBookingRow),
  };
}

/** `admin/users`: arama satiri. */
export function toMobileAdminUser(u: AdminUserSource) {
  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? "",
    phone: u.phone ?? "",
    whatsapp: toWhatsAppNumber(u.phone),
    role: u.role,
    isBanned: u.isBanned,
    isTest: u.isTest,
    bookingCount: u._count.bookings,
    shopCount: u._count.shops,
    createdAt: u.createdAt.toISOString(),
  };
}

type AdminMessageSource = {
  id: string;
  from: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  isRead: boolean;
  category: string;
  createdAt: Date;
  replies: { createdAt: Date }[];
};

/** Mobil gelen kutusunda bir mesajin govdesi bu kadar karakterle sinirli. */
const ADMIN_MESSAGE_BODY_MAX = 4000;

/**
 * `admin/messages` satiri. Ham Prisma satiri (200 mesajin tam HTML'i) yerine: govde yalnizca
 * duz metin (yalniz-HTML posta icin etiketlerden arindirilmis), `repliedAt` en son cevap.
 */
export function toMobileAdminMessage(m: AdminMessageSource) {
  const body = (m.text?.trim() || stripHtmlToText(m.html).trim()).slice(0, ADMIN_MESSAGE_BODY_MAX);
  return {
    id: m.id,
    from: m.from,
    subject: m.subject,
    text: body || null,
    isRead: m.isRead,
    category: m.category,
    createdAt: m.createdAt.toISOString(),
    repliedAt: m.replies[0]?.createdAt.toISOString() ?? null,
  };
}

/** Ana sayfa "Populer sehirler" karti. */
export function toMobileCity(c: import("@/services/CityCoverageService").CityCoverage) {
  return {
    name: c.name,
    shopCount: c.shopCount,
    latitude: c.latitude,
    longitude: c.longitude,
    radiusM: c.radiusM,
    coverImage: c.coverImage,
  };
}

/** Dukkan galerisindeki bir fotograf (esnaf yonetimi icin kimlikli). */
export function toMobileGalleryImage(i: { id: string; url: string }) {
  return { id: i.id, url: i.url };
}

/** Misafirin dukkan detayindaki galeri: yalnizca adresler, sirali. */
export function toMobilePublicGallery(images: Array<{ url: string }>) {
  return images.map((i) => i.url);
}

type PartnerShopSource = {
  id: string;
  name: string;
  image: string | null;
  capacity: number;
  pricePerDay: unknown;
  address: string | null;
  city: string | null;
  district: string | null;
  openingTime: string | null;
  closingTime: string | null;
  open247: boolean;
};

/**
 * Esnaf `partner/shop` GET/PUT govdesi. ONCEDEN `...shop` yayilimiydi: sahip
 * kimligi, test bayragi, saat dilimi gibi ic kolonlar telefona gidiyor, yeni
 * eklenen her kolon da kendiliginden sizip cikiyordu; PUT yanitinda
 * `pricePerDay` Decimal oldugu icin string geliyordu. Alan listesi acik.
 */
export function toMobilePartnerShop(
  shop: PartnerShopSource,
  extras: Record<string, unknown> = {},
) {
  return {
    id: shop.id,
    name: shop.name,
    image: shop.image,
    capacity: shop.capacity,
    pricePerDay: moneyToNumber(shop.pricePerDay),
    address: shop.address,
    city: shop.city,
    district: shop.district,
    openingTime: shop.openingTime,
    closingTime: shop.closingTime,
    open247: shop.open247,
    ...extras,
  };
}

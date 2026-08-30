import { moneyToNumber } from "@/lib/money";

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
  guest: { name: string | null } | null;
  shop: {
    name: string;
    /* Sema `Float?`: koordinatsiz dukkan (henuz haritaya islenmemis) mumkun. */
    latitude: number | null;
    longitude: number | null;
    owner: { phone: string | null };
  };
  seals: Array<{ sealNumber: number; bagIndex: number; bagSize: string }>;
};

export function toMobileBookingDetail(b: BookingDetailSource) {
  return {
    ...toMobileBookingSummary(b),
    qrCodeToken: b.qrCodeToken,
    guestName: b.guest?.name ?? "",
    latitude: b.shop.latitude,
    longitude: b.shop.longitude,
    shopPhone: b.shop.owner.phone ?? "",
    seals: b.seals.map((s) => ({
      sealNumber: s.sealNumber,
      bagIndex: s.bagIndex,
      bagSize: s.bagSize,
    })),
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
 * normal bir dükkandan AYIRT EDEMEZ: ₺50 (şema varsayılanı, gerçek fiyat değil)
 * ve "Rezervasyon yap" gösterir, misafir dener ve sunucudan `409
 * shop_not_open_yet` yer. Sunucu kapısı sağlam, ama misafire tutamayacağımız
 * sözü verdikten sonra reddetmek kapının işi değil — arayüzün işi.
 */
export function toMobileShop(s: ShopSummarySource) {
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
  };
}

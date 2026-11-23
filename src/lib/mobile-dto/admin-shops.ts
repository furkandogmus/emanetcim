import { moneyToNumber } from "@/lib/money";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { shopVisibilityIssues } from "@/lib/shop-visibility";
import { storageCitiesListingShop } from "@/lib/storage-cities";
import type { AdminOps } from "./internal";
import { canViewAs } from "./admin-users";
import { toMobileAdminBookingRow } from "./admin-bookings";
import { toMobileGalleryImage } from "./shop";

type AdminShopSource = Awaited<ReturnType<AdminOps["shopsOccupancy"]>>[number];

type AdminShopDetailSource = NonNullable<Awaited<ReturnType<AdminOps["shopDetail"]>>>;

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
    // Yonetici sayisi gizlenen yorumlari DA sayar (moderasyon listesiyle ayni); misafir sayilari saymaz.
    reviewCount: s._count.reviews,
    bagsInStorage: d.bagsInStorage,
    arrivalsToday: d.arrivalsToday,
    pickupsToday: d.pickupsToday,
    cityPages,
    issues: s.isPrelaunch || s.isTest ? [] : issues,
    recent: d.recent.map(toMobileAdminBookingRow),
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMIN DUKKAN ICERIGI + YORUM MODERASYONU (2026-11-23)
   Yonetici esnaf adina fotograf/saat duzenler, yorumlari gizler ya da siler.
   ───────────────────────────────────────────────────────────────────────── */

/** `admin/shops/:id/images`: kapak + galeri; esnafin `partner/shop` yanitindaki alanlarla ayni bicim. */
export function toMobileAdminShopPhotos(s: { image: string | null; gallery: Array<{ id: string; url: string }> }) {
  return { image: s.image, gallery: s.gallery.map(toMobileGalleryImage) };
}

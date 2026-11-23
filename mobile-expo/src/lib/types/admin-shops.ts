import type { AdminBookingRow } from "./admin-bookings";
import type { ShopGalleryImage } from "./shop";

/** `admin/shops` (`toMobileAdminShop`). */
export type AdminShop = {
  id: string;
  name: string;
  place: string;
  capacity: number;
  rating: number | null;
  isPrelaunch: boolean;
  isActive: boolean;
  isTest: boolean;
  isVerified: boolean;
  /** Misafirden saklayan durumlar (sunucu `shopVisibilityIssues`); talep testi ve test kaydinda bos. */
  issues: ShopVisibilityIssue[];
  phone: string;
  whatsapp?: string | null;
  bagsInStorage: number;
  arrivalsToday: number;
  pickupsToday: number;
};

export type ShopVisibilityIssue = "inactive" | "noLocation" | "noCityPage" | "noPhoto";

/** `/admin/shops/:id` (sunucu `toMobileAdminShopDetail`). */
export type AdminShopDetail = {
  id: string;
  name: string;
  address: string;
  place: string;
  capacity: number;
  rating: number;
  pricePerDay: number;
  isActive: boolean;
  isTest: boolean;
  isVerified: boolean;
  isPrelaunch: boolean;
  hasPhoto: boolean;
  latitude: number | null;
  longitude: number | null;
  /** null = 7/24 acik. */
  hours: { open: string; close: string } | null;
  createdAt: string;
  owner: { id: string; name: string; email: string; phone: string; whatsapp?: string | null; canViewAs?: boolean };
  bookingCount: number;
  reviewCount: number;
  bagsInStorage: number;
  arrivalsToday: number;
  pickupsToday: number;
  /** Dukkani listeleyen sehir sayfalarinin slug'lari. */
  cityPages: string[];
  issues: ShopVisibilityIssue[];
  recent: AdminBookingRow[];
};

export type AdminShopPatch = Partial<
  Pick<
    AdminShopDetail,
    "name" | "address" | "capacity" | "pricePerDay" | "isActive" | "isTest" | "isVerified" | "latitude" | "longitude"
  >
>;

/** `GET admin/shops/:id/images` (`toMobileAdminShopPhotos`). */
export type AdminShopPhotos = { image: string | null; gallery: ShopGalleryImage[] };

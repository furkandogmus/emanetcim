/**
 * Mobil API govdeleri. Kaynak: `../../src/lib/mobile-dto.ts` (web reposu) ve
 * uclarin kendisi. Orada bir alan degisirse burasi da degismeli.
 */

export type Role = "GUEST" | "PARTNER" | "ADMIN";

export type MobileUser = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  emailVerified: boolean;
};

export type SessionResponse = {
  accessToken: string;
  refreshToken: string;
  user: MobileUser;
};

export type BookingStatus =
  | "PENDING"
  | "PAID"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED";

export type Shop = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
  pricePerDay: number;
  capacity: number;
  rating: number | null;
  openingTime: string | null;
  closingTime: string | null;
  open247: boolean;
  hasRestroom: boolean;
  isActive: boolean;
  isVerified: boolean;
  /** Talep testi noktasi: haritada gorunur ama rezervasyon ALINMAZ. */
  isPrelaunch: boolean;
};

export type NearbyShop = Shop & {
  distanceKm: number;
  /** Yalnizca tarih filtresiyle aranirsa gelir. */
  bagsAvailable?: number;
};

export type ShopDetail = Shop & {
  weeklyHours?: { weekday: number; isClosed: boolean; openingTime: string; closingTime: string }[];
  closures?: { startDate: string; endDate: string }[];
  pricing: {
    bagMultiplierS: number;
    bagMultiplierM: number;
    bagMultiplierXl: number;
    insuranceFeeTry: number;
  };
};

export type BookingSummary = {
  id: string;
  shopId: string;
  shopName: string;
  checkInTime: string;
  checkOutTime: string;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  totalPrice: number;
  status: BookingStatus;
};

export type BookingDetail = BookingSummary & {
  qrCodeToken: string | null;
  guestName: string;
  latitude: number | null;
  longitude: number | null;
  shopPhone: string;
  seals: { sealNumber: number; bagIndex: number; bagSize: string }[];
};

export type PartnerBooking = BookingSummary & { guestName: string };

export type PartnerBookingsResponse = {
  items: PartnerBooking[];
  total: number;
  page: number;
  limit: number;
};

export type CheckoutRequest = {
  shopId: string;
  checkInTime: string;
  checkOutTime: string;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
};

export type CheckoutResponse = {
  bookingId: string;
  status: BookingStatus;
  totalPrice: number;
};

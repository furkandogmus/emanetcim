import { useQuery } from "@tanstack/react-query";

import { api } from "./api";
import { usePartnerShopSelection, withShop } from "./partner-shop";
import type { AdminApplication, AdminStats, BookingDetail, ContactMessage, PartnerEarnings, PartnerSealsResponse, PartnerShop, BookingSummary, NearbyShop, PartnerBookingsResponse, ShopDetail, ShopReview, PartnerShopSettings, PartnerSchedule, PartnerDashboard } from "./types";

export const keys = {
  myBookings: ["bookings", "me"] as const,
  booking: (id: string) => ["bookings", id] as const,
  shop: (id: string) => ["shops", id] as const,
  partnerBookings: ["partner", "bookings"] as const,
  partnerShop: ["partner", "shop"] as const,
  partnerSeals: ["partner", "seals"] as const,
  admin: ["admin"] as const,
};

export function useMyBookings() {
  return useQuery({
    queryKey: keys.myBookings,
    queryFn: () => api<BookingSummary[]>("/bookings/me?limit=50"),
  });
}

export function useBooking(id: string) {
  return useQuery({ queryKey: keys.booking(id), queryFn: () => api<BookingDetail>(`/bookings/${id}`) });
}

export function useShop(id: string) {
  return useQuery({ queryKey: keys.shop(id), queryFn: () => api<ShopDetail>(`/shops/${id}`, { auth: false }) });
}

export function useShopReviews(id: string) {
  return useQuery({
    queryKey: ["shops", id, "reviews"],
    queryFn: () => api<ShopReview[]>(`/shops/${id}/reviews`, { auth: false }),
  });
}

export type NearbyParams = {
  latitude: number;
  longitude: number;
  radiusM: number;
  checkIn: Date;
  checkOut: Date;
  bags: number;
};

export function useNearbyShops(p: NearbyParams | null) {
  return useQuery({
    enabled: !!p,
    queryKey: ["shops", "nearby", p && { ...p, checkIn: p.checkIn.toISOString(), checkOut: p.checkOut.toISOString() }],
    queryFn: () => {
      const q = new URLSearchParams({
        lat: String(p!.latitude),
        lng: String(p!.longitude),
        r: String(Math.round(p!.radiusM)),
        limit: "50",
        checkIn: p!.checkIn.toISOString(),
        checkOut: p!.checkOut.toISOString(),
        bags: String(p!.bags),
      });
      return api<NearbyShop[]>(`/shops/nearby?${q}`, { auth: false });
    },
  });
}

export function usePartnerBookings() {
  return useQuery({
    queryKey: keys.partnerBookings,
    queryFn: () => api<PartnerBookingsResponse>("/partner/bookings?limit=100"),
    // Esnaf ekrani acik dururken yeni rezervasyon gelirse gorsun (push gelene kadar).
    refetchInterval: 30_000,
  });
}

/**
 * Henuz bitmemis rezervasyon. Alma saati gecmis olsa bile valiz dukkandaysa
 * (CHECKED_IN) hala aktiftir -- misafirin QR'a ihtiyaci var.
 */
export function isActiveBooking(b: { status: string }) {
  return !["CANCELLED", "CHECKED_OUT"].includes(b.status);
}

export function useAdminStats() {
  return useQuery({ queryKey: [...keys.admin, "stats"], queryFn: () => api<AdminStats>("/admin/stats") });
}

export function useAdminApplications() {
  return useQuery({
    queryKey: [...keys.admin, "applications"],
    queryFn: () => api<AdminApplication[]>("/admin/applications"),
  });
}

export function useAdminMessages() {
  return useQuery({ queryKey: [...keys.admin, "messages"], queryFn: () => api<ContactMessage[]>("/admin/messages") });
}

export function usePartnerShop() {
  return useQuery({ queryKey: keys.partnerShop, queryFn: () => api<PartnerShop>("/partner/shop") });
}

export function usePartnerSeals() {
  const [shopId] = usePartnerShopSelection();
  return useQuery({
    queryKey: [...keys.partnerSeals, shopId ?? "default"],
    queryFn: () => api<PartnerSealsResponse>(withShop("/partner/seals", shopId)),
  });
}

/** `usePartnerShop` ile ayni istek ve anahtar; yalnizca tip genis. */
export function usePartnerShopSettings() {
  return useQuery({ queryKey: keys.partnerShop, queryFn: () => api<PartnerShopSettings>("/partner/shop") });
}

export const partnerScheduleKey = ["partner", "schedule"] as const;

export function usePartnerSchedule() {
  return useQuery({ queryKey: partnerScheduleKey, queryFn: () => api<PartnerSchedule>("/partner/shop/schedule") });
}

export function usePartnerEarnings() {
  return useQuery({
    queryKey: ["partner", "earnings"],
    queryFn: () => api<PartnerEarnings>("/partner/earnings/stats"),
  });
}

/**
 * Esnafin gunluk ozeti. `["partner", ...]` ailesinde: teslim al / et sonrasi
 * `["partner"]` gecersiz kilininca sayilar da yenilenir. Dukkan esnaf
 * ekranlarinin ortak seciminden (`partner-shop.tsx`).
 */
export function usePartnerDashboard() {
  const [shopId] = usePartnerShopSelection();
  return useQuery({
    queryKey: ["partner", "dashboard", shopId ?? "default"],
    queryFn: () =>
      api<PartnerDashboard>(withShop("/partner/dashboard", shopId)),
    // Dukkan degisirken kart yukleme durumuna dusup dukkan seridini sifirlamasin.
    placeholderData: (prev) => prev,
  });
}

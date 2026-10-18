import { useQuery } from "@tanstack/react-query";

import { api } from "./api";
import type { AdminApplication, AdminStats, BookingDetail, ContactMessage, PartnerSealsResponse, PartnerShop, BookingSummary, NearbyShop, PartnerBookingsResponse, ShopDetail, ShopReview } from "./types";

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
  return useQuery({ queryKey: keys.partnerSeals, queryFn: () => api<PartnerSealsResponse>("/partner/seals") });
}

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { PartnerSchedule, AdminShop, AdminShopDetail, AdminShopPhotos } from "../types";
import { keys } from "./keys";

export function useAdminShops() {
  return useQuery({
    queryKey: [...keys.admin, "shops"],
    queryFn: () => api<{ shops: AdminShop[] }>("/admin/shops").then((r) => r.shops),
  });
}

export function useAdminShop(id: string) {
  return useQuery({
    queryKey: [...keys.admin, "shop", id],
    queryFn: () => api<AdminShopDetail>(`/admin/shops/${encodeURIComponent(id)}`),
    enabled: !!id,
  });
}

/* ── Admin dukkan icerigi + yorum moderasyonu ──────────────────────────────
   Anahtarlar `[...keys.admin, "shop", id]` altinda: dukkan detayi yenilenince
   fotograf ve saat de yenilenir. Yorumlar ayri kok (`adminReviewsKey`). */

export const adminShopPhotosKey = (id: string) => [...keys.admin, "shop", id, "photos"] as const;

export const adminShopScheduleKey = (id: string) => [...keys.admin, "shop", id, "schedule"] as const;

export function useAdminShopPhotos(id: string) {
  return useQuery({
    queryKey: adminShopPhotosKey(id),
    queryFn: () => api<AdminShopPhotos>(`/admin/shops/${encodeURIComponent(id)}/images`),
    enabled: !!id,
  });
}

export function useAdminShopSchedule(id: string) {
  return useQuery({
    queryKey: adminShopScheduleKey(id),
    queryFn: () => api<PartnerSchedule>(`/admin/shops/${encodeURIComponent(id)}/schedule`),
    enabled: !!id,
  });
}

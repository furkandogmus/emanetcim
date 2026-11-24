import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { usePartnerShopSelection, withShop } from "../partner-shop";
import { nextCursorOf } from "../paging";
import { partnerSearchTerm } from "../booking-search";
import { useDebouncedValue } from "../use-debounced-value";
import type { PartnerEarnings, PartnerSealsResponse, PartnerShop, PartnerBookingsResponse, PartnerShopSettings, PartnerSchedule, PartnerDashboard } from "../types";
import { keys } from "./keys";
import { dashboardAccess } from "../shop-access";

/**
 * `polling`: esnaf listesi ekranda gorunurken 30 sn'de bir yenilenir (push gelene kadar).
 * Liste Stack'te altta kalinca (detay, tarama acikken) yoklama durur; 100 kayit tasiyor.
 */
export function usePartnerBookings(polling = true) {
  return useQuery({
    queryKey: keys.partnerBookings,
    queryFn: () => api<PartnerBookingsResponse>("/partner/bookings?limit=100"),
    refetchInterval: polling ? 30_000 : false,
  });
}

/**
 * Gecmis sekmesinde "Daha eski kayitlar": ilk sayfanin `nextCursor`'undan devam eder.
 * Baslangic imleci dokunuldugu andaki deger olarak sabit tutulur; ilk sayfa 30 sn'de
 * bir yenilenip imleci kaydirsa da yuklenen eski sayfalar sifirlanmaz (tekrarlar
 * ekranda id ile ayiklanir). `start` null iken istek atilmaz.
 */
export function usePartnerOlderBookings(start: string | null) {
  return useInfiniteQuery({
    queryKey: [...keys.partnerBookings, "older", start],
    enabled: !!start,
    initialPageParam: start ?? "",
    queryFn: ({ pageParam }) =>
      api<PartnerBookingsResponse>(`/partner/bookings?limit=100&cursor=${encodeURIComponent(pageParam)}`),
    getNextPageParam: nextCursorOf,
  });
}

/** Arama yazma durduktan bu kadar sonra gider. */
export const PARTNER_SEARCH_DEBOUNCE_MS = 300;

export function partnerSearchKey(shopId: string | null, term: string) {
  return [...keys.partnerBookings, "search", shopId ?? "all", term] as const;
}

/** Sunucu aramasi: kod on eki, misafir adi, telefonun son haneleri; tum tarihler. `shopId` yalnizca cok dukkanlida. */
export function fetchPartnerBookingSearch(term: string, shopId: string | null, cursor?: string, signal?: AbortSignal) {
  const qs = new URLSearchParams({ q: term, limit: "50", ...(shopId ? { shopId } : {}), ...(cursor ? { cursor } : {}) });
  return api<PartnerBookingsResponse>(`/partner/bookings?${qs}`, { signal });
}

/**
 * Esnaf listesindeki arama kutusu. `term` bos donerse ekran normal sekme listesini gosterir
 * (istek de yok). Anahtar `["partner", "bookings", ...]` ailesinde: islem sonrasi gecersiz
 * kilinan liste aramayi da yeniler.
 */
export function usePartnerBookingSearch(raw: string, shopId: string | null) {
  const term = partnerSearchTerm(useDebouncedValue(raw, PARTNER_SEARCH_DEBOUNCE_MS, (v) => !partnerSearchTerm(v)));
  const query = useInfiniteQuery({
    queryKey: partnerSearchKey(shopId, term),
    enabled: term.length > 0,
    initialPageParam: undefined as string | undefined,
    // Yeni terim eski istegi iptal eder (signal): gec gelen eski yanit bant genisligi yemesin.
    queryFn: ({ pageParam, signal }) => fetchPartnerBookingSearch(term, shopId, pageParam, signal),
    getNextPageParam: nextCursorOf,
  });
  // Yazilan terim henuz gonderilmediyse (geciktirme suruyor) sonuc eskidir.
  const pending = partnerSearchTerm(raw) !== term;
  return { term, pending, query };
}

export function usePartnerShop() {
  const [shopId] = usePartnerShopSelection();
  // Dukkan ayarlari `manage`: personelde sunucu reddeder, istek hic gitmez.
  const staff = useShopAccess() === "staff";
  return useQuery({
    queryKey: [...keys.partnerShop, shopId ?? "default"],
    queryFn: () => api<PartnerShop>(withShop("/partner/shop", shopId)),
    enabled: !staff,
  });
}

/** Secili dukkandaki yetki (`partner/dashboard`); yuklenene kadar ve eski sunucuda sahip. */
export function useShopAccess() {
  return dashboardAccess(usePartnerDashboard().data);
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
  const [shopId] = usePartnerShopSelection();
  return useQuery({
    queryKey: [...keys.partnerShop, shopId ?? "default"],
    queryFn: () => api<PartnerShopSettings>(withShop("/partner/shop", shopId)),
  });
}

export const partnerScheduleKey = ["partner", "schedule"] as const;

export function usePartnerSchedule() {
  const [shopId] = usePartnerShopSelection();
  return useQuery({
    queryKey: [...partnerScheduleKey, shopId ?? "default"],
    queryFn: () => api<PartnerSchedule>(withShop("/partner/shop/schedule", shopId)),
  });
}

export function usePartnerEarnings() {
  const [shopId] = usePartnerShopSelection();
  return useQuery({
    queryKey: ["partner", "earnings", shopId ?? "default"],
    // Pano gibi secili dukkani izler; kazanc ekrani tum dukkanlari topluyordu.
    queryFn: () => api<PartnerEarnings>(withShop("/partner/earnings/stats", shopId)),
    placeholderData: (prev) => prev,
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

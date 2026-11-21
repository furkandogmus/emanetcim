import { useInfiniteQuery, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { api, ApiError, isImpersonating } from "./api";
import { isBookingExpired } from "./booking-state";
import { deleteOfflineTicket, saveOfflineTicket } from "./offline-tickets";
import { useAuth } from "./auth";
import { usePartnerShopSelection, withShop } from "./partner-shop";
import { nextCursorOf } from "./paging";
import type { AdminApplication, AdminStats, BookingDetail, ContactMessage, PartnerEarnings, PartnerSealsResponse, PartnerShop, BookingSummary, NearbyShop, PartnerBookingsResponse, ShopDetail, ShopReviewsPage, PartnerShopSettings, PartnerSchedule, PartnerDashboard, AdminOverview, AdminBookingFilter, AdminBookingCounts, AdminBookingsResponse, AdminBookingDetail, AdminShop, AdminShopDetail, AdminUser, CityCoverage, AppConfig } from "./types";

export const keys = {
  myBookings: ["bookings", "me"] as const,
  booking: (id: string) => ["bookings", id] as const,
  shop: (id: string) => ["shops", id] as const,
  partnerBookings: ["partner", "bookings"] as const,
  partnerShop: ["partner", "shop"] as const,
  partnerSeals: ["partner", "seals"] as const,
  admin: ["admin"] as const,
};

/**
 * Sunucu yapilandirmasi (kimliksiz). Odeme metinleri `paymentMode`a baglanir:
 * kip bilinmiyorsa dukkanda tahsilat (bugun gercek olan) varsayilir, boylece
 * hicbir ekran kartla odeme ya da karta iade vaat etmez.
 */
export function useAppConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => api<AppConfig>("/config", { auth: false }),
    staleTime: 10 * 60_000,
  });
}

export function useOnlinePayments(): boolean {
  return useAppConfig().data?.paymentMode === "online";
}

/** Dukkani olan sehirler; yeni sehirde esnaf acilinca kendiliginden gelir. */
export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: () => api<{ cities: CityCoverage[] }>("/cities", { auth: false }).then((r) => r.cities),
    staleTime: 10 * 60_000,
  });
}

/** Cihaza yazilan bilet: aktif ve en yakin 5 rezervasyon (offline-tickets.ts tavani). */
const OFFLINE_PREFETCH = 5;

export function useMyBookings() {
  // Giris yapmadan gezen misafirde istek atilmaz (401 olurdu).
  const { state } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: keys.myBookings,
    queryFn: async () => {
      const list = await api<BookingSummary[]>("/bookings/me?limit=50");
      /*
        Bilet, misafir detay ekranini acmadan da cihaza yazilsin: liste her
        geldiginde aktif rezervasyonlarin detayi (QR dahil) arka planda cekilir.
        Aksi halde internetsiz acilista bilet yalnizca daha once acilmis
        rezervasyonlar icin vardi.
      */
      if (!isImpersonating()) {
        list
          .filter((b) => isActiveBooking(b))
          .sort((a, b) => +new Date(a.checkInTime) - +new Date(b.checkInTime))
          .slice(0, OFFLINE_PREFETCH)
          .forEach((b) => prefetchBooking(queryClient, b.id, { saveOffline: true }));
      }
      return list;
    },
    enabled: state.status === "signedIn",
  });
}

/**
 * Detay istegi. `saveOffline` (yalnizca misafir): basarida bilet cihaza yazilir,
 * sunucu 404/403 derse eski bilet silinir (silinmis/baskasinin rezervasyonunun QR'i kalmasin).
 */
async function fetchBooking(id: string, saveOffline: boolean): Promise<BookingDetail> {
  try {
    const b = await api<BookingDetail>(`/bookings/${id}`);
    if (saveOffline && !isImpersonating()) void saveOfflineTicket(b).catch(() => undefined);
    return b;
  } catch (e) {
    if (saveOffline && e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      void deleteOfflineTicket(id).catch(() => undefined);
    }
    throw e;
  }
}

/**
 * Satira dokunulur dokunulmaz (parmak kalkmadan) detay istegini baslatir: ekran
 * acildiginda bilet cogu zaman hazir. 30 sn icinde cekildiyse tekrar gitmez.
 */
export function prefetchBooking(queryClient: QueryClient, id: string, opts: { saveOffline?: boolean } = {}) {
  void queryClient.prefetchQuery({
    queryKey: keys.booking(id),
    queryFn: () => fetchBooking(id, !!opts.saveOffline),
    staleTime: 30_000,
  });
}

export function useBooking(id: string, opts: { saveOffline?: boolean } = {}) {
  return useQuery({ queryKey: keys.booking(id), queryFn: () => fetchBooking(id, !!opts.saveOffline) });
}

export function useShop(id: string) {
  return useQuery({ queryKey: keys.shop(id), queryFn: () => api<ShopDetail>(`/shops/${id}`, { auth: false }) });
}

/** Dukkan ekranindaki ozet: ilk 5 yorum ve gercek toplam (dizi ucu 50'de kesip toplam vermiyordu). */
export function useShopReviews(id: string) {
  return useQuery({
    queryKey: ["shops", id, "reviews", "summary"],
    queryFn: () => api<ShopReviewsPage>(`/shops/${id}/reviews?paged=1&limit=5`, { auth: false }),
  });
}

/** "Tum yorumlar" ekrani. */
export function useShopReviewsInfinite(id: string) {
  return useInfiniteQuery({
    queryKey: ["shops", id, "reviews", "all"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<ShopReviewsPage>(
        `/shops/${id}/reviews?paged=1&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        { auth: false },
      ),
    getNextPageParam: nextCursorOf,
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
        // Saate oturmayan dukkanlar da gelsin (bookable:false); eski istemci bunu gondermez.
        includeClosed: "1",
      });
      return api<NearbyShop[]>(`/shops/nearby?${q}`, { auth: false });
    },
  });
}

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

/**
 * Henuz bitmemis rezervasyon. Valiz dukkandaysa (CHECKED_IN) alma saati gecse de
 * aktiftir: misafirin QR'a ihtiyaci var. Hic teslim edilmemis kayit ise alma saati
 * gecince aktif degildir: gelmeyen misafirin APPROVED/PAID kaydi sonsuza dek oyle
 * kalir ve "Siradaki" kartini, sekme rozetini ve Yaklasan listesini dolduruyordu.
 */
export function isActiveBooking(
  b: { status: string; checkOutTime: string; expired?: boolean },
  now: number = Date.now(),
) {
  if (b.status === "CHECKED_IN") return true;
  if (b.status === "CANCELLED" || b.status === "CHECKED_OUT") return false;
  if (isBookingExpired(b, now)) return false;
  return new Date(b.checkOutTime).getTime() > now;
}

export function useAdminStats() {
  return useQuery({ queryKey: [...keys.admin, "stats"], queryFn: () => api<AdminStats>("/admin/stats") });
}

export function useAdminOverview() {
  return useQuery({ queryKey: [...keys.admin, "overview"], queryFn: () => api<AdminOverview>("/admin/overview") });
}

export function useAdminApplications() {
  return useQuery({
    queryKey: [...keys.admin, "applications"],
    queryFn: () => api<AdminApplication[]>("/admin/applications"),
  });
}

export const adminMessagesKey = [...keys.admin, "messages", "paged"] as const;
export type AdminMessagesPage = { messages: ContactMessage[]; nextCursor: string | null };

/** Sayfali (30'ar); dizi ucu 100'de kesiliyordu ve devami yoktu. */
export function useAdminMessages() {
  return useInfiniteQuery({
    queryKey: adminMessagesKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<AdminMessagesPage>(`/admin/messages?paged=1${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: nextCursorOf,
  });
}

export function usePartnerShop() {
  const [shopId] = usePartnerShopSelection();
  return useQuery({
    queryKey: [...keys.partnerShop, shopId ?? "default"],
    queryFn: () => api<PartnerShop>(withShop("/partner/shop", shopId)),
  });
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

/**
 * Ekran `q`'yu geciktirerek verir. 2 karakterin altindaki arama hic gonderilmez; anahtar
 * da ayni normal hali kullanir ki ilk tus ayni istegi ikinci kez atmasin.
 */
export function useAdminBookings(filter: AdminBookingFilter, q: string) {
  const term = q.trim().length >= 2 ? q.trim() : "";
  return useInfiniteQuery({
    queryKey: [...keys.admin, "bookings", "list", filter, term],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ filter, ...(term ? { q: term } : {}), ...(pageParam ? { cursor: pageParam } : {}) });
      return api<AdminBookingsResponse>(`/admin/bookings?${qs}`);
    },
    getNextPageParam: nextCursorOf,
    placeholderData: (prev) => prev,
  });
}

/** Cip adetleri aramadan bagimsiz: ayri istek, 30 sn taze. */
export function useAdminBookingCounts() {
  return useQuery({
    queryKey: [...keys.admin, "bookings", "counts"],
    queryFn: () => api<AdminBookingCounts>("/admin/bookings/counts"),
    staleTime: 30_000,
  });
}

export function useAdminBooking(id: string) {
  return useQuery({
    queryKey: [...keys.admin, "booking", id],
    queryFn: () => api<AdminBookingDetail>(`/admin/bookings/${encodeURIComponent(id)}`),
  });
}

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

export function useAdminUsers(q: string) {
  const term = q.trim();
  return useInfiniteQuery({
    queryKey: [...keys.admin, "users", "list", term],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ ...(term ? { q: term } : {}), ...(pageParam ? { cursor: pageParam } : {}) });
      return api<{ users: AdminUser[]; nextCursor?: string | null }>(`/admin/users?${qs}`);
    },
    getNextPageParam: nextCursorOf,
    placeholderData: (prev) => prev,
  });
}

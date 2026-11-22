import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { api, ApiError, isImpersonating } from "./api";
import { adminCancelBooking, adminForceCheckout, partnerCancelBooking, partnerNoShow, type AdminBookingAction } from "./booking-actions";
import { isBookingExpired } from "./booking-state";
import { deleteOfflineTicket, saveOfflineTicket } from "./offline-tickets";
import { useAuth } from "./auth";
import { usePartnerShopSelection, withShop } from "./partner-shop";
import { nextCursorOf } from "./paging";
import { totalBags, type Bags } from "./search";
import { partnerSearchTerm } from "./booking-search";
import { useDebouncedValue } from "./use-debounced-value";
import { BROADCAST_POLL_MS, hasActiveBroadcast } from "./broadcast";
import type { AdminApplication, AdminStats, BookingDetail, ContactMessage, PartnerEarnings, PartnerSealsResponse, PartnerShop, BookingSummary, NearbyShop, PartnerBookingsResponse, ShopDetail, ShopReviewsPage, PartnerShopSettings, PartnerSchedule, PartnerDashboard, AdminOverview, AdminBookingFilter, AdminBookingCounts, AdminBookingsResponse, AdminBookingDetail, AdminShop, AdminShopDetail, AdminUser, AdminBroadcast, BroadcastAudience, BroadcastPreview, CityCoverage, AppConfig, PartnerCancelRequest, AdminAuditPage, AdminUserDetail, AdminReviewFilter, AdminReviewsPage, AdminShopPhotos, ReviewModerationAction, AdminCoupon, AdminDispute, AdminDisputeStatus, AdminFeatureFlag, AdminPayments, AdminPlatformSettings } from "./types";

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
  bags: Bags;
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
        // Eski sunucu icin toplam adet de gider; boy adetleriyle sunucu kalis toplamini ekler.
        bags: String(totalBags(p!.bags)),
        bagsS: String(p!.bags.s),
        bagsM: String(p!.bags.m),
        bagsXl: String(p!.bags.xl),
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

export const adminBroadcastsKey = [...keys.admin, "broadcasts"] as const;

/** Secili kitleye kac kisi/cihaz: kitle degisince anahtar degisir, yeniden sorulur. */
export function useBroadcastPreview(audience: BroadcastAudience | null) {
  return useQuery({
    queryKey: [...adminBroadcastsKey, "preview", audience],
    queryFn: () => api<BroadcastPreview>("/admin/broadcasts/preview", { method: "POST", body: { audience } }),
    enabled: audience !== null,
  });
}

/** Son duyurular; listede QUEUED/SENDING varken birkac saniyede bir yoklanir, yoksa durur. */
export function useAdminBroadcasts() {
  return useQuery({
    queryKey: [...adminBroadcastsKey, "list"],
    queryFn: () => api<{ items: AdminBroadcast[] }>("/admin/broadcasts?limit=20").then((r) => r.items),
    refetchInterval: (q) => (hasActiveBroadcast(q.state.data) ? BROADCAST_POLL_MS : false),
  });
}

/*
  Yonetim islemleri. Hata da `onSettled`da yeniler: `invalid_status` cogu zaman baska
  birinin (misafir, esnaf, zamanlanmis is) rezervasyonu degistirdigi demek; ekran eski
  durumda kalirsa ayni dugme tekrar tekrar reddedilir.
*/
type InvalidatingClient = Pick<QueryClient, "invalidateQueries">;

function refreshAfterAdminAction(qc: InvalidatingClient, id: string) {
  void qc.invalidateQueries({ queryKey: [...keys.admin, "booking", id] });
  void qc.invalidateQueries({ queryKey: [...keys.admin, "bookings"] });
  void qc.invalidateQueries({ queryKey: [...keys.admin, "overview"] });
  void qc.invalidateQueries({ queryKey: [...keys.admin, "shop"] });
  void qc.invalidateQueries({ queryKey: keys.booking(id) });
}

function refreshAfterPartnerAction(qc: InvalidatingClient) {
  void qc.invalidateQueries({ queryKey: ["bookings"] });
  void qc.invalidateQueries({ queryKey: ["partner"] });
}

export function adminBookingActionOptions(qc: InvalidatingClient, id: string) {
  return {
    mutationFn: ({ action, note }: { action: AdminBookingAction; note: string }) =>
      action === "cancel" ? adminCancelBooking(id, note) : adminForceCheckout(id, note),
    onSettled: () => refreshAfterAdminAction(qc, id),
  };
}

export function partnerCancelOptions(qc: InvalidatingClient, id: string) {
  return {
    mutationFn: (body: PartnerCancelRequest) => partnerCancelBooking(id, body),
    onSettled: () => refreshAfterPartnerAction(qc),
  };
}

export function partnerNoShowOptions(qc: InvalidatingClient, id: string) {
  return { mutationFn: () => partnerNoShow(id), onSettled: () => refreshAfterPartnerAction(qc) };
}

export function useAdminBookingAction(id: string) {
  return useMutation(adminBookingActionOptions(useQueryClient(), id));
}

export function usePartnerCancel(id: string) {
  return useMutation(partnerCancelOptions(useQueryClient(), id));
}

export function usePartnerNoShow(id: string) {
  return useMutation(partnerNoShowOptions(useQueryClient(), id));
}

/* ===================== Admin kullanici yonetimi ===================== */

export const adminUserKey = (id: string) => [...keys.admin, "users", "detail", id] as const;

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: adminUserKey(id),
    queryFn: () => api<{ user: AdminUserDetail }>(`/admin/users/${encodeURIComponent(id)}`).then((r) => r.user),
    enabled: !!id,
  });
}

/** Denetim kaydi: onek ve kullanici degisince anahtar degisir; ilk sayfa onekleri tasir. */
export function useAdminAuditLog(prefix: string | null, userId: string | null) {
  return useInfiniteQuery({
    queryKey: [...keys.admin, "audit-log", prefix ?? "", userId ?? ""],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({
        ...(prefix ? { action: prefix } : {}),
        ...(userId ? { userId } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      });
      return api<AdminAuditPage>(`/admin/audit-log?${qs}`);
    },
    getNextPageParam: nextCursorOf,
    placeholderData: (prev) => prev,
  });
}


/* ── Admin dukkan icerigi + yorum moderasyonu ──────────────────────────────
   Anahtarlar `[...keys.admin, "shop", id]` altinda: dukkan detayi yenilenince
   fotograf ve saat de yenilenir. Yorumlar ayri kok (`adminReviewsKey`). */

export const adminShopPhotosKey = (id: string) => [...keys.admin, "shop", id, "photos"] as const;
export const adminShopScheduleKey = (id: string) => [...keys.admin, "shop", id, "schedule"] as const;
export const adminReviewsKey = [...keys.admin, "reviews"] as const;

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

/** `shopId` verilirse o dukkanin yorumlari, yoksa platformun son yorumlari. */
export function useAdminReviews(filter: AdminReviewFilter, shopId?: string | null) {
  return useInfiniteQuery({
    queryKey: [...adminReviewsKey, shopId ?? "all", filter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ filter, ...(pageParam ? { cursor: pageParam } : {}) });
      const base = shopId ? `/admin/shops/${encodeURIComponent(shopId)}/reviews` : "/admin/reviews";
      return api<AdminReviewsPage>(`${base}?${qs}`);
    },
    getNextPageParam: nextCursorOf,
  });
}

export function moderateReviewOptions(qc: InvalidatingClient) {
  return {
    mutationFn: ({ id, action, reason }: { id: string; action: ReviewModerationAction; reason?: string }) =>
      // Bos gerekce `undefined` kalir ve JSON'a girmez (geri almada gonderilmez).
      api(`/admin/reviews/${encodeURIComponent(id)}/${action}`, { method: "POST", body: { reason: reason || undefined } }),
    // Hata da yeniler: `already_hidden`/`not_found` cogu zaman baska bir yoneticinin isi.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminReviewsKey });
      void qc.invalidateQueries({ queryKey: [...keys.admin, "shop"] });
      void qc.invalidateQueries({ queryKey: [...keys.admin, "shops"] });
    },
  };
}

export function useModerateReview() {
  return useMutation(moderateReviewOptions(useQueryClient()));
}


/* ===================== Yonetim araclari (uyusmazlik, kupon, odeme, ayar, bayrak) ===================== */

export const adminOpsKeys = {
  disputes: [...keys.admin, "disputes"] as const,
  coupons: [...keys.admin, "coupons"] as const,
  payments: [...keys.admin, "payments"] as const,
  settings: [...keys.admin, "platform-settings"] as const,
  flags: [...keys.admin, "feature-flags"] as const,
};

/** `status` null = hepsi. */
export function useAdminDisputes(status: AdminDisputeStatus | null) {
  return useQuery({
    queryKey: [...adminOpsKeys.disputes, "list", status ?? "ALL"],
    queryFn: () =>
      api<{ items: AdminDispute[] }>(`/admin/disputes${status ? `?status=${status}` : ""}`).then((r) => r.items),
    placeholderData: (prev) => prev,
  });
}

export function useAdminDispute(id: string) {
  return useQuery({
    queryKey: [...adminOpsKeys.disputes, "one", id],
    queryFn: () => api<AdminDispute>(`/admin/disputes/${encodeURIComponent(id)}`),
    enabled: !!id,
  });
}

export function useAdminCoupons() {
  return useQuery({
    queryKey: adminOpsKeys.coupons,
    queryFn: () => api<{ items: AdminCoupon[] }>("/admin/coupons").then((r) => r.items),
  });
}

export function useAdminPayments(status: string) {
  return useQuery({
    queryKey: [...adminOpsKeys.payments, status],
    queryFn: () => api<AdminPayments>(`/admin/payments${status !== "ALL" ? `?status=${encodeURIComponent(status)}` : ""}`),
    placeholderData: (prev) => prev,
  });
}

export function useAdminPlatformSettings() {
  return useQuery({ queryKey: adminOpsKeys.settings, queryFn: () => api<AdminPlatformSettings>("/admin/platform-settings") });
}

export function useAdminFeatureFlags() {
  return useQuery({
    queryKey: adminOpsKeys.flags,
    queryFn: () => api<{ items: AdminFeatureFlag[] }>("/admin/feature-flags").then((r) => r.items),
  });
}

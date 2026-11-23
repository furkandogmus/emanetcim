import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api, ApiError, isImpersonating } from "../api";
import { isBookingExpired } from "../booking-state";
import { deleteOfflineTicket, saveOfflineTicket } from "../offline-tickets";
import { useAuth } from "../auth";
import type { BookingDetail, BookingSummary } from "../types";
import { keys } from "./keys";

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

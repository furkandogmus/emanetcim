import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { nextCursorOf } from "../paging";
import type { AdminBookingFilter, AdminBookingCounts, AdminBookingsResponse, AdminBookingDetail } from "../types";
import { keys } from "./keys";

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

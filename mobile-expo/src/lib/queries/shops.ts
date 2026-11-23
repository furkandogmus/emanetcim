import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { nextCursorOf } from "../paging";
import { totalBags, type Bags } from "../search";
import type { NearbyShop, ShopDetail, ShopReviewsPage } from "../types";
import { keys } from "./keys";

export function useShop(id: string) {
  /*
    Token gider (2026-11-23): inceleme hesabi test dukkanini da gorur. Uc 401
    donmez; bayat token `optionalAuth` ile yenilenir, olmazsa istek anonim kalir.
  */
  return useQuery({ queryKey: keys.shop(id), queryFn: () => api<ShopDetail>(`/shops/${id}`, { optionalAuth: true }) });
}

/** Dukkan ekranindaki ozet: ilk 5 yorum ve gercek toplam (dizi ucu 50'de kesip toplam vermiyordu). */
export function useShopReviews(id: string) {
  return useQuery({
    queryKey: ["shops", id, "reviews", "summary"],
    queryFn: () => api<ShopReviewsPage>(`/shops/${id}/reviews?paged=1&limit=5`, { optionalAuth: true }),
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
        { optionalAuth: true },
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
      // Token gider: kum havuzu hesabi test dukkanlarini da gorur (bkz. `useShop`).
      return api<NearbyShop[]>(`/shops/nearby?${q}`, { optionalAuth: true });
    },
  });
}

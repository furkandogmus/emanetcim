import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { nextCursorOf } from "../paging";
import type { AdminReviewFilter, AdminReviewsPage, ReviewModerationAction } from "../types";
import type { InvalidatingClient } from "./internal";
import { keys } from "./keys";

export const adminReviewsKey = [...keys.admin, "reviews"] as const;

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

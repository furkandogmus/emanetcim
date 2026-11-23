import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { BROADCAST_POLL_MS, hasActiveBroadcast } from "../broadcast";
import type { AdminBroadcast, BroadcastAudience, BroadcastPreview } from "../types";
import { keys } from "./keys";

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

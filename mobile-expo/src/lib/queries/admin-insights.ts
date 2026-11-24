import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { nextCursorOf } from "../paging";
import type { AdminAnalytics, AdminNotificationLogPage, AdminPrelaunch, AdminSystem } from "../types";
import { keys } from "./keys";

/* ===================== Yonetici gorunurluk ekranlari (salt okuma) ===================== */

export const adminInsightKeys = {
  analytics: [...keys.admin, "analytics"] as const,
  system: [...keys.admin, "system"] as const,
  notificationLogs: [...keys.admin, "notification-logs"] as const,
  prelaunch: [...keys.admin, "prelaunch"] as const,
};

export function useAdminAnalytics(days: number) {
  return useQuery({
    queryKey: [...adminInsightKeys.analytics, days],
    queryFn: () => api<AdminAnalytics>(`/admin/analytics?days=${days}`),
    placeholderData: (prev) => prev,
  });
}

/** Ozet karti da bunu okur; bir dakika taze sayilir (her sekme donusunde sorgulanmasin). */
export function useAdminSystem() {
  return useQuery({
    queryKey: adminInsightKeys.system,
    queryFn: () => api<AdminSystem>("/admin/system"),
    staleTime: 60_000,
  });
}

export type NotificationLogFilter = { status: string | null; type: string | null; q: string };

export function useAdminNotificationLogs(f: NotificationLogFilter) {
  const q = f.q.trim();
  return useInfiniteQuery({
    queryKey: [...adminInsightKeys.notificationLogs, f.status ?? "", f.type ?? "", q],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({
        ...(f.status ? { status: f.status } : {}),
        ...(f.type ? { type: f.type } : {}),
        ...(q ? { q } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      });
      return api<AdminNotificationLogPage>(`/admin/notification-logs?${qs}`);
    },
    getNextPageParam: nextCursorOf,
    placeholderData: (prev) => prev,
  });
}

export function useAdminPrelaunch() {
  return useQuery({ queryKey: adminInsightKeys.prelaunch, queryFn: () => api<AdminPrelaunch>("/admin/prelaunch") });
}

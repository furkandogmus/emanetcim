import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { nextCursorOf } from "../paging";
import type { AdminUser, AdminAuditPage, AdminUserDetail, AdminUserFilters } from "../types";
import { keys } from "./keys";

export const NO_USER_FILTERS: AdminUserFilters = { role: null, status: null, type: null };

/** Bos suzgec sorgu metnine girmez: eski sunucu ayni istegi gorur. */
export function adminUserListParams(q: string, filters: AdminUserFilters, cursor?: string): URLSearchParams {
  const term = q.trim();
  return new URLSearchParams({
    ...(term ? { q: term } : {}),
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(cursor ? { cursor } : {}),
  });
}

export function useAdminUsers(q: string, filters: AdminUserFilters = NO_USER_FILTERS) {
  const term = q.trim();
  return useInfiniteQuery({
    queryKey: [...keys.admin, "users", "list", term, filters.role ?? "", filters.status ?? "", filters.type ?? ""],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const qs = adminUserListParams(term, filters, pageParam);
      return api<{ users: AdminUser[]; nextCursor?: string | null }>(`/admin/users?${qs}`);
    },
    getNextPageParam: nextCursorOf,
    placeholderData: (prev) => prev,
  });
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

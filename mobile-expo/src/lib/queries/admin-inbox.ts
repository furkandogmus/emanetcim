import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { nextCursorOf } from "../paging";
import type { AdminApplication, AdminPartnerLead, AdminRoleChangeRequest, ContactMessage } from "../types";
import { keys } from "./keys";

export function useAdminApplications() {
  return useQuery({
    queryKey: [...keys.admin, "applications"],
    queryFn: () => api<AdminApplication[]>("/admin/applications"),
  });
}

export function useAdminPartnerLeads() {
  return useQuery({
    queryKey: [...keys.admin, "partner-leads"],
    queryFn: () => api<AdminPartnerLead[]>("/admin/partner-leads"),
  });
}

export function useAdminRoleApprovals() {
  return useQuery({
    queryKey: [...keys.admin, "role-approvals"],
    queryFn: () => api<AdminRoleChangeRequest[]>("/admin/role-approvals"),
  });
}

export const adminMessagesKey = [...keys.admin, "messages", "paged"] as const;

export type AdminMessageCategory = "SUPPORT" | "BULK" | "AUTOMATED";

/** Web kutusu ile ayni: varsayilan gorunum destek, okunmamis/tumu ve arama. */
export type AdminMessageFilters = { unreadOnly: boolean; category: AdminMessageCategory | null; q: string };

export const DEFAULT_MESSAGE_FILTERS: AdminMessageFilters = { unreadOnly: false, category: "SUPPORT", q: "" };

export type AdminMessageCounts = Record<AdminMessageCategory, number> & { unread: number };

/** `counts` yalniz ilk sayfada (eski sunucuda hic yok). */
export type AdminMessagesPage = { messages: ContactMessage[]; nextCursor: string | null; counts?: AdminMessageCounts };

export function adminMessageParams(f: AdminMessageFilters, cursor?: string): URLSearchParams {
  const q = f.q.trim();
  return new URLSearchParams({
    paged: "1",
    ...(f.unreadOnly ? { unread: "1" } : {}),
    ...(f.category ? { category: f.category } : {}),
    ...(q ? { q } : {}),
    ...(cursor ? { cursor } : {}),
  });
}

/** Sayfali (30'ar); dizi ucu 100'de kesiliyordu ve devami yoktu. Suzgec anahtara girer. */
export function useAdminMessages(f: AdminMessageFilters = DEFAULT_MESSAGE_FILTERS) {
  return useInfiniteQuery({
    queryKey: [...adminMessagesKey, f.unreadOnly ? "unread" : "all", f.category ?? "ALL", f.q.trim()],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api<AdminMessagesPage>(`/admin/messages?${adminMessageParams(f, pageParam)}`),
    getNextPageParam: nextCursorOf,
    placeholderData: (prev) => prev,
  });
}

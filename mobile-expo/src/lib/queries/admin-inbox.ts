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

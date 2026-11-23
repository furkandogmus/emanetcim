import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { AdminCoupon, AdminAffiliate, AdminDispute, AdminDisputeStatus, AdminFeatureFlag, AdminPayments, AdminPlatformSettings } from "../types";
import { keys } from "./keys";

/* ===================== Yonetim araclari (uyusmazlik, kupon, odeme, ayar, bayrak) ===================== */

export const adminOpsKeys = {
  disputes: [...keys.admin, "disputes"] as const,
  coupons: [...keys.admin, "coupons"] as const,
  affiliates: [...keys.admin, "affiliates"] as const,
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

export function useAdminAffiliates() {
  return useQuery({
    queryKey: adminOpsKeys.affiliates,
    queryFn: () => api<{ items: AdminAffiliate[] }>("/admin/affiliates").then((r) => r.items),
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

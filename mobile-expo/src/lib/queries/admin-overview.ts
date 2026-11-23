import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { AdminStats, AdminOverview } from "../types";
import { keys } from "./keys";

export function useAdminStats() {
  return useQuery({ queryKey: [...keys.admin, "stats"], queryFn: () => api<AdminStats>("/admin/stats") });
}

export function useAdminOverview() {
  return useQuery({ queryKey: [...keys.admin, "overview"], queryFn: () => api<AdminOverview>("/admin/overview") });
}

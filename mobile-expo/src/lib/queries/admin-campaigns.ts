import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { AdminCampaign } from "../types";
import { keys } from "./keys";

export const adminCampaignKeys = { list: [...keys.admin, "campaigns"] as const };

export function useAdminCampaigns() {
  return useQuery({
    queryKey: adminCampaignKeys.list,
    queryFn: () => api<{ items: AdminCampaign[] }>("/admin/campaigns").then((r) => r.items),
  });
}

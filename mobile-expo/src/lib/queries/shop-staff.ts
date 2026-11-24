import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { usePartnerShopSelection, withShop } from "../partner-shop";
import type { ShopTeam, ShopTeamInviteResult } from "../types";

const teamKey = (shopId: string | null) => ["partner", "team", shopId ?? "default"] as const;

/** Sahibin ekip ekrani (`GET partner/team`); personel 403 alir. */
export function useShopTeam() {
  const [shopId] = usePartnerShopSelection();
  return useQuery({
    queryKey: teamKey(shopId),
    queryFn: () => api<ShopTeam>(withShop("/partner/team", shopId)),
  });
}

function useTeamMutation<V, R>(fn: (shopId: string | null, v: V) => Promise<R>) {
  const [shopId] = usePartnerShopSelection();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => fn(shopId, v),
    onSettled: () => qc.invalidateQueries({ queryKey: ["partner", "team"] }),
  });
}

export function useInviteStaff() {
  return useTeamMutation((shopId, v: { email: string; locale: string }) =>
    api<ShopTeamInviteResult>(withShop("/partner/team", shopId), { method: "POST", body: v }),
  );
}

export function useRemoveStaff() {
  return useTeamMutation((shopId, userId: string) =>
    api(withShop(`/partner/team/members/${encodeURIComponent(userId)}`, shopId), { method: "DELETE" }),
  );
}

export function useRevokeStaffInvite() {
  return useTeamMutation((shopId, inviteId: string) =>
    api(withShop(`/partner/team/invites/${encodeURIComponent(inviteId)}`, shopId), { method: "DELETE" }),
  );
}

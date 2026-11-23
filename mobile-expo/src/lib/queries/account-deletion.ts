import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { AdminDeletionAction, AdminDeletionRequest, MyDeletionRequest } from "../types";
import { keys } from "./keys";

export const myDeletionRequestKey = ["account", "deletion-request"] as const;
export const adminDeletionsKey = [...keys.admin, "account-deletions"] as const;

/** Esnaf/yonetici: kendi silme talebi (yoksa `status: null`). */
export function useMyDeletionRequest(enabled: boolean) {
  return useQuery({
    queryKey: myDeletionRequestKey,
    enabled,
    queryFn: () => api<MyDeletionRequest>("/account/deletion-request"),
  });
}

export function useRequestAccountDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { locale?: string; note?: string }) =>
      api<MyDeletionRequest>("/account/deletion-request", { method: "POST", body }),
    onSuccess: (data) => qc.setQueryData(myDeletionRequestKey, data),
  });
}

export function useAdminDeletionRequests() {
  return useQuery({
    queryKey: adminDeletionsKey,
    queryFn: () => api<{ items: AdminDeletionRequest[] }>("/admin/account-deletions").then((r) => r.items),
  });
}

export function useResolveDeletionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: AdminDeletionAction; reason?: string }) =>
      api<{ ok: true }>(`/admin/account-deletions/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        body: { reason: reason || undefined },
      }),
    onSettled: () => void qc.invalidateQueries({ queryKey: adminDeletionsKey }),
  });
}

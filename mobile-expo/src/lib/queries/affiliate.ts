import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { AffiliateApplication, AffiliatePanel, DataExportResult } from "../types";

/** Anahtarda kullanici: cikis/giriste onceki hesabin paneli bir an bile gorunmesin. */
export const myAffiliateKey = (userId: string | null) => ["affiliate", "me", userId] as const;

export function useMyAffiliate(userId: string | null) {
  return useQuery({
    queryKey: myAffiliateKey(userId),
    enabled: !!userId,
    queryFn: () => api<{ panel: AffiliatePanel | null }>("/affiliate/me").then((r) => r.panel),
  });
}

type Invalidator = { invalidateQueries: (f: { queryKey: readonly unknown[] }) => Promise<unknown> };

export function applyAffiliateOptions(qc: Invalidator, userId: string | null) {
  return {
    mutationFn: (body: AffiliateApplication) => api<{ ok: true }>("/affiliate/apply", { method: "POST", body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: myAffiliateKey(userId) }).catch(() => undefined),
  };
}

export function useApplyAffiliate(userId: string | null) {
  const qc = useQueryClient();
  return useMutation(applyAffiliateOptions(qc, userId));
}

/** KVKK disa aktarimi: sunucu dosyayi hesabin dogrulanmis adresine e-postalar. */
export const dataExportOptions = {
  mutationFn: (body: { locale?: string }) => api<DataExportResult>("/account/data-export", { method: "POST", body }),
};

export function useRequestDataExport() {
  return useMutation(dataExportOptions);
}

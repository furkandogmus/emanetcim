import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { WalkInRequest, WalkInResult } from "../types";

/** Kapidan gelen misafir: secili dukkanda rezervasyon + teslim (`POST partner/walk-in`). */
export function useCreateWalkIn(shopId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: WalkInRequest) =>
      api<WalkInResult>("/partner/walk-in", { method: "POST", body: { ...v, shopId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["partner"] });
    },
  });
}

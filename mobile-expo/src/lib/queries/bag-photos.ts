import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { BagPhotoList } from "../types";
import type { UploadFile } from "../shop-photo";

export const bagPhotosKey = (bookingId: string) => ["bagPhotos", bookingId] as const;

/**
 * Imzali adresler 5 dk gecerli: 4 dk'dan eski liste bayat sayilir. Eski sunucuda uc yoksa
 * (404) sorgu hata verir ve bolum hic cizilmez; tekrar denenmez.
 */
export function useBagPhotos(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: bagPhotosKey(bookingId),
    queryFn: () => api<BagPhotoList>(`/bookings/${bookingId}/bag-photos`),
    enabled,
    staleTime: 4 * 60_000,
    retry: false,
  });
}

export function useUploadBagPhoto(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: UploadFile) => {
      const form = new FormData();
      form.append("file", file as unknown as Blob);
      return api<{ ok: true; id: string }>(`/bookings/${bookingId}/bag-photos`, { method: "POST", body: form });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: bagPhotosKey(bookingId) }),
  });
}

export function useDeleteBagPhoto(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => api(`/bookings/${bookingId}/bag-photos/${photoId}`, { method: "DELETE" }),
    onSettled: () => void qc.invalidateQueries({ queryKey: bagPhotosKey(bookingId) }),
  });
}

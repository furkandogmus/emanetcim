import type { BagPhotoList } from "@/services/BagPhotoService";

/** `GET /api/mobile/bookings/[id]/bag-photos`. `url` imzali ve `expiresAt`e kadar gecerli. */
export function toMobileBagPhotoList(list: BagPhotoList) {
  return {
    photos: list.photos.map((p) => ({ id: p.id, url: p.url, createdAt: p.createdAt, expiresAt: p.expiresAt })),
    canUpload: list.canUpload,
    canDelete: list.canDelete,
    maxPhotos: list.maxPhotos,
    storageReady: list.storageReady,
  };
}

/** `GET /bookings/[id]/bag-photos` (sunucu `toMobileBagPhotoList`). `url` imzali, `expiresAt`e kadar gecerli. */
export type BagPhoto = { id: string; url: string; createdAt: string; expiresAt: string };

export type BagPhotoList = {
  photos: BagPhoto[];
  canUpload: boolean;
  canDelete: boolean;
  maxPhotos: number;
  storageReady: boolean;
};

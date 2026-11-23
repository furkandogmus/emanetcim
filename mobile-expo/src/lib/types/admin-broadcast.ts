/** Duyuru hedef kitlesi (sunucu `BroadcastAudience`). */
export type BroadcastAudience = "PARTNERS" | "GUESTS" | "ALL";

export type BroadcastStatus = "QUEUED" | "SENDING" | "DONE" | "FAILED";

/** `POST /admin/broadcasts/preview`. */
export type BroadcastPreview = { users: number; devices: number };

/** `GET /admin/broadcasts` satiri (sunucu `toMobileAdminBroadcast`). */
export type AdminBroadcast = {
  id: string;
  audience: BroadcastAudience;
  titleTr: string;
  bodyTr: string;
  status: BroadcastStatus;
  targetedDevices: number;
  sent: number;
  failed: number;
  createdAt: string;
  finishedAt: string | null;
  createdByName: string;
};

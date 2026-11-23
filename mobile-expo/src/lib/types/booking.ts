import type { CancelReason } from "../booking-state";

export type BookingStatus =
  | "PENDING"
  | "PAID"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED";

export type BookingSummary = {
  id: string;
  shopId: string;
  shopName: string;
  checkInTime: string;
  checkOutTime: string;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  totalPrice: number;
  status: BookingStatus;
  /** Suresi dolmus (gelinmemis) rezervasyon; sunucu karar verir. Eski sunucu gondermez. */
  expired?: boolean;
  /**
   * Iptal edilmis rezervasyonun nedeni. Eski sunucu gondermez: `undefined` `null` gibi
   * okunur (`cancelReasonOf`). Bilinmeyen yeni deger de neden yazmadan dusulur.
   */
  cancelReason?: CancelReason | (string & {}) | null;
};

export type { CancelReason } from "../booking-state";

export type BookingDetail = BookingSummary & {
  qrCodeToken: string | null;
  guestName: string;
  /** Yalnizca esnaf/yonetici ve aktif rezervasyonda dolu; aksi halde bos. */
  guestPhone?: string;
  latitude: number | null;
  longitude: number | null;
  shopPhone: string;
  /** "Adres, semt, sehir". Eski sunucu gondermez. */
  shopAddress?: string;
  seals: { sealNumber: number; bagIndex: number; bagSize: string }[];
  /** Eski sunucu gondermez; o zaman tekrar gonderim 409 ile yakalanir. */
  hasReview?: boolean;
  hasDispute?: boolean;
  /** Bildirimin durumu (`toMobileDisputeStatus`); bildirim yoksa ya da eski sunucuda yok. */
  disputeStatus?: DisputeStatus | null;
  /** Esnafin onerdigi, misafir onayi bekleyen valiz duzeltmesi. */
  pendingBagRevision?: PendingBagRevision | null;
  /** Yalnizca esnaf/admin ve CHECKED_IN: su an teslim edilirse gecikme ucreti ve erken iade. */
  checkoutPreview?: { lateFeeTry: number; earlyRefund: number } | null;
  /**
   * Yalnizca esnaf/admin: "Misafir gelmedi" bu andan (ISO) sonra kullanilabilir; `null`
   * bu rezervasyonda hic yok demek. Eski sunucu gondermez, `undefined` `null` sayilir.
   */
  noShowAvailableAt?: string | null;
  /**
   * Gec birakma: valiz birakilmadiysa rezervasyonun otomatik kapanacagi an (ISO);
   * uygulanmiyorsa `null`. Istemci ancak birakma saati gectiyse gosterir. Eski sunucu gondermez.
   */
  lateCloseAt?: string | null;
  /** Esnafin "Misafiri bekle" ile verdigi son an (ISO); yoksa `null`. */
  lateHoldUntil?: string | null;
};

/** `partner/bookings/[id]/cancel` neden secenekleri. */
export type PartnerCancelReason = "guest_request" | "shop_closed" | "capacity" | "other";

export type PartnerCancelRequest = { reason: PartnerCancelReason; note?: string };

/** Yonetim islem uclarinin (iptal, zorla teslim, gelmedi) ortak yaniti. */
export type BookingActionResponse = { success: true };

export type PendingBagRevision = {
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  extraAmount: number;
  newTotal: number;
};

/** `partner/bookings/[id]/bag-revision` POST govdesi; uc eksik boyutu mevcut degerden tamamlar. */
export type BagRevisionRequest = { bagCountS: number; bagCountM: number; bagCountXl: number };

export type BagRevisionResponse = { success: true; newTotal: number };

export type DisputeReason = "DAMAGE" | "THEFT" | "OTHER";

/** `../src/lib/dispute-status.ts` ile ayni liste. */
export type DisputeStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";

/** `POST disputes`. Aciklama 10-2000 karakter (uc semasi). */
export type CreateDisputeRequest = { bookingId: string; reason: DisputeReason; description: string };

export type CreateDisputeResponse = { success: true; id: string };

/* ===================== Yonetim araclari (kaynak: ../src/lib/mobile-dto/admin-ops.ts, toMobileAdmin*) ===================== */

export type AdminDisputeStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";

/** `toMobileAdminDispute`: liste satiri ve detay ayni govde. */
export type AdminDispute = {
  id: string;
  bookingId: string;
  reason: string;
  description: string;
  status: AdminDisputeStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  booking: {
    id: string;
    totalPrice: number;
    checkInTime: string;
    checkOutTime: string;
    status: string;
    guestName: string | null;
    guestEmail: string | null;
    shopName: string | null;
    seals: { id: string; sealNumber: number; bagIndex: number; bagSize: string; photoUrl: string | null }[];
  };
};

/** `toMobileAdminCoupon`. */
export type AdminCoupon = {
  id: string;
  code: string;
  discount: number;
  isPercent: boolean;
  minPrice: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

/** `toMobileAdminPayments`: salt okunur defter. */
export type AdminPayments = {
  status: string;
  summary: {
    capturedAmount: number;
    capturedCount: number;
    refundedAmount: number;
    pendingSplitAmount: number;
    pendingSplitCount: number;
    failedCount: number;
  };
  payments: {
    id: string;
    bookingId: string;
    status: string;
    provider: string;
    amount: number;
    refundedAmount: number;
    failureReason: string | null;
    chargebackStatus: string | null;
    createdAt: string;
    capturedAt: string | null;
    guestLabel: string | null;
    shopName: string;
    splitStatus: string | null;
    merchantAmount: number | null;
    platformCommission: number | null;
  }[];
  accounts: {
    id: string;
    shopName: string;
    city: string | null;
    provider: string;
    status: string;
    rejectionReason: string | null;
    activatedAt: string | null;
  }[];
};

export type AdminPlatformSettingsValues = {
  maxStayDays: number;
  maxBagsPerSlot: number;
  insuranceFeeTry: number;
  earlyRefundRatio: number;
  cancelFixedFeeTry: number;
  latePickupFeeTry: number;
  latePickupGraceMin: number;
  checkInGraceMin: number;
  requireSealsOnCheckIn: boolean;
  defaultShopCapacity: number;
  defaultPricePerDay: number;
  bagMultiplierS: number;
  bagMultiplierM: number;
  bagMultiplierXl: number;
  platformHolidayDates: string[];
  minAppVersion: string | null;
  latestAppVersion: string | null;
  /** Magaza yayin bayraklari; eski sunucu gondermez (yoksa kapali sayilir). */
  iosAppStoreLive?: boolean;
  androidPlayLive?: boolean;
  /** Uygulama rezervasyonu indirimi (yuzde, 0 = kapali); eski sunucu gondermez. */
  appBookingDiscountPct?: number;
};

/**
 * `toMobileAdminPlatformSettings`. `riskyFields` yalniz etiket icindir; hangi degisikligin
 * onay istedigine ve ifadeye sunucu karar verir (428 `confirmation_required`).
 * `updatedAt` PUT'ta `expectedUpdatedAt` olarak geri gider (409 `stale_settings`).
 */
export type AdminPlatformSettings = {
  values: AdminPlatformSettingsValues;
  riskyFields: (keyof AdminPlatformSettingsValues)[];
  updatedAt: string | null;
};

/** 428 `confirmation_required` govdesi (ayar): eski -> yeni ve yazilacak ifade. */
export type SettingsConfirmChallenge = {
  phrase: string;
  changes: { field: keyof AdminPlatformSettingsValues; from: unknown; to: unknown }[];
};

/** `toMobileAdminFeatureFlag`. Riskli bayrakta onay ifadesi bayragin anahtari. */
export type AdminFeatureFlag = {
  key: string;
  enabled: boolean;
  rolloutPct: number;
  allowedUserIds: string[];
  description: string | null;
  risky: boolean;
  updatedAt: string;
};

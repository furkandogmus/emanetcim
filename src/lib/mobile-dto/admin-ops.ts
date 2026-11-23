import { moneyToNumber } from "@/lib/money";
import type { PaymentsLedger } from "@/services/AdminPaymentsService";
import type { PlatformSettingsValues } from "@/services/PlatformSettingsService";
import { RISKY_PLATFORM_SETTING_FIELDS, isRiskyFeatureFlag } from "@/lib/admin-risky-settings";

/* ===================== Yonetim araclari (uyusmazlik, kupon, odeme, ayar, bayrak) ===================== */

type AdminDisputeSource = {
  id: string;
  bookingId: string;
  reason: string;
  description: string;
  status: string;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  booking: {
    id: string;
    totalPrice: unknown;
    checkInTime: Date;
    checkOutTime: Date;
    status: string;
    guest: { name: string | null; email: string | null } | null;
    shop: { name: string } | null;
    seals: { id: string; sealNumber: number; bagIndex: number; bagSize: string; photoUrl: string | null }[];
  };
};

/** `admin/disputes` satiri ve detayi (ayni govde; misafir raporu + rezervasyon baglami + muhur kaniti). */
export function toMobileAdminDispute(d: AdminDisputeSource) {
  return {
    id: d.id,
    bookingId: d.bookingId,
    reason: d.reason,
    description: d.description,
    status: d.status,
    adminNote: d.adminNote,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    booking: {
      id: d.booking.id,
      totalPrice: moneyToNumber(d.booking.totalPrice),
      checkInTime: d.booking.checkInTime.toISOString(),
      checkOutTime: d.booking.checkOutTime.toISOString(),
      status: d.booking.status,
      guestName: d.booking.guest?.name ?? null,
      guestEmail: d.booking.guest?.email ?? null,
      shopName: d.booking.shop?.name ?? null,
      seals: d.booking.seals.map((s) => ({
        id: s.id,
        sealNumber: s.sealNumber,
        bagIndex: s.bagIndex,
        bagSize: s.bagSize,
        photoUrl: s.photoUrl,
      })),
    },
  };
}

type AdminCouponSource = {
  id: string;
  code: string;
  discount: unknown;
  isPercent: boolean;
  minPrice: unknown | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
};

export function toMobileAdminCoupon(c: AdminCouponSource) {
  return {
    id: c.id,
    code: c.code,
    discount: moneyToNumber(c.discount),
    isPercent: c.isPercent,
    minPrice: c.minPrice == null ? null : moneyToNumber(c.minPrice),
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}

/** `admin/payments`: `getPaymentsLedger` zaten duz sayi/ISO uretir; alanlar burada acikca secilir. */
export function toMobileAdminPayments(l: PaymentsLedger) {
  return {
    status: l.status,
    summary: { ...l.summary },
    payments: l.payments.map((p) => ({
      id: p.id,
      bookingId: p.bookingId,
      status: p.status,
      provider: p.provider,
      amount: p.amount,
      refundedAmount: p.refundedAmount,
      failureReason: p.failureReason,
      chargebackStatus: p.chargebackStatus,
      createdAt: p.createdAt,
      capturedAt: p.capturedAt,
      guestLabel: p.guestLabel,
      shopName: p.shopName,
      splitStatus: p.splitStatus,
      merchantAmount: p.merchantAmount,
      platformCommission: p.platformCommission,
    })),
    accounts: l.accounts.map((a) => ({
      id: a.id,
      shopName: a.shopName,
      city: a.city,
      provider: a.provider,
      status: a.status,
      rejectionReason: a.rejectionReason,
      activatedAt: a.activatedAt,
    })),
  };
}

/** `riskyFields` onay isteyebilecek alanlar (etiket icin); onay ifadesi 428 yanitinda gelir. */
export function toMobileAdminPlatformSettings(s: {
  values: PlatformSettingsValues;
  updatedAt: Date | null;
}) {
  return {
    values: { ...s.values, platformHolidayDates: [...s.values.platformHolidayDates] },
    riskyFields: [...RISKY_PLATFORM_SETTING_FIELDS],
    updatedAt: s.updatedAt?.toISOString() ?? null,
  };
}

type AdminFeatureFlagSource = {
  key: string;
  enabled: boolean;
  rolloutPct: number;
  allowedUserIds: unknown;
  description: string | null;
  updatedAt: Date;
};

export function toMobileAdminFeatureFlag(f: AdminFeatureFlagSource) {
  return {
    key: f.key,
    enabled: f.enabled,
    rolloutPct: f.rolloutPct,
    allowedUserIds: Array.isArray(f.allowedUserIds)
      ? f.allowedUserIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [],
    description: f.description,
    risky: isRiskyFeatureFlag(f.key),
    updatedAt: f.updatedAt.toISOString(),
  };
}

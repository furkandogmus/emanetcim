"use server";

import { auth } from "@/auth";
import { bookingService } from "@/services/BookingService";
import { notificationService } from "@/services/NotificationService";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { verifyQrToken } from "@/lib/qr-token";
import { normalizeTrGsm10 } from "@/lib/netgsm";
import { getLocale } from "next-intl/server";
import { sealService } from "@/services/SealService";
import { BookingStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import logger from "@/lib/logger";
import { bookingEventService } from "@/services/BookingEventService";
import { getPricingRules } from "@/lib/platform-settings";
import { readPricingSnapshot } from "@/lib/pricing-snapshot";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { moneyToNumber } from "@/lib/money";

function revalidatePartnerPaths() {
  revalidatePathAllLocales("/partner");
  revalidatePathAllLocales("/partner/bookings");
  revalidatePathAllLocales("/partner/settings");
}

/**
 * QR / ham id ile rezervasyon önizlemesi (esnaf paneli).
 */
export async function getPartnerBookingPreviewAction(raw: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false as const, error: "Errors.authRequired" };
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    return { success: false as const, error: "Errors.notAuthorizedPartner" };
  }

  let bookingId = raw.trim();
  const payload = await verifyQrToken(bookingId);
  if (payload) bookingId = payload.bookingId;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { guest: true, shop: true },
  });

  if (!booking) {
    return { success: false as const, error: "Errors.bookingNotFound" };
  }

  if (
    session.user.role === "PARTNER" &&
    booking.shop.ownerId !== session.user.id
  ) {
    return {
      success: false as const,
      error: "Errors.unauthorized",
    };
  }

  const total = booking.bagCountS + booking.bagCountM + booking.bagCountXl;
  const bagsLabel = `${total} valiz · S:${booking.bagCountS} M:${booking.bagCountM} XL:${booking.bagCountXl}`;

  return {
    success: true as const,
    bookingId: booking.id,
    guestName: booking.guest?.name || "Misafir",
    bagsLabel,
    bagCountS: booking.bagCountS,
    bagCountM: booking.bagCountM,
    bagCountXl: booking.bagCountXl,
    totalBags: total,
    status: booking.status,
    pendingBagRevision: booking.pendingBagRevision,
  };
}

/**
 * Check-out öncesi rezervasyona bağlı mühür listesi (onay ekranı).
 */
export async function getPartnerBookingSealsAction(bookingIdRaw: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Errors.authRequired" };
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    return { success: false as const, error: "Errors.notAuthorizedPartner" };
  }

  let bookingId = bookingIdRaw.trim();
  const payload = await verifyQrToken(bookingIdRaw);
  if (payload) bookingId = payload.bookingId;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true },
  });
  if (!booking) {
    return { success: false as const, error: "Errors.bookingNotFound" };
  }
  if (booking.shop.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    return { success: false as const, error: "Errors.unauthorized" };
  }

  const seals = await prisma.bookingSeal.findMany({
    where: { bookingId },
    orderBy: { bagIndex: "asc" },
    select: {
      sealNumber: true,
      bagIndex: true,
      bagSize: true,
    },
  });

  return {
    success: true as const,
    bookingId,
    seals: seals.map((s) => ({
      sealNumber: s.sealNumber,
      bagIndex: s.bagIndex,
      bagSize: s.bagSize,
    })),
  };
}

/**
 * checkInAction - QR JWT veya ham token / booking id ile check-in.
 */
export async function checkInAction(
  qrTokenOrBookingId: string
) {
  const session = await auth();

  if (session?.user?.role !== "PARTNER" && session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  let bookingId = qrTokenOrBookingId.trim();
  const payload = await verifyQrToken(qrTokenOrBookingId);
  if (payload) bookingId = payload.bookingId;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true, guest: { select: { email: true } } },
  });
  if (!booking) {
    return {
      success: false as const,
      error: "Errors.bookingNotFound",
      code: "NOT_FOUND" as const,
    };
  }

  if (session.user.role === "PARTNER" && booking.shop.ownerId !== session.user.id) {
    return {
      success: false as const,
      error: "Errors.unauthorized",
      code: "FORBIDDEN" as const,
    };
  }

  // Aktör kim: dükkanda tahsilat modunda check-in aynı zamanda "parayı aldım"
  // beyanıdır ve bu denetim izine yazılır (P1-9).
  const result = await bookingService.checkIn(bookingId, undefined, {
    id: session.user.id,
    role: session.user.role,
  });

  if (result.ok) {
    if (booking.guest?.email) {
      const locale = await getLocale();
      await notificationService.notifyCheckIn(booking.guest.email, booking.id, locale);
    }

    revalidatePartnerPaths();
    return { success: true as const };
  }

  return {
    success: false as const,
    error: result.message,
    code: result.code,
  };
}

/**
 * checkOutAction - Esnafın valizi müşteriye teslim ettiği adım.
 */
export async function checkOutAction(qrTokenOrBookingId: string) {
  const session = await auth();

  if (session?.user?.role !== "PARTNER" && session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  let bookingId = qrTokenOrBookingId.trim();
  const payload = await verifyQrToken(qrTokenOrBookingId);
  if (payload) bookingId = payload.bookingId;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true, guest: { select: { email: true } } },
  });
  if (!booking) {
    return {
      success: false as const,
      error: "Errors.bookingNotFound",
      code: "NOT_FOUND" as const,
    };
  }
  if (session.user.role === "PARTNER" && booking.shop.ownerId !== session.user.id) {
    return {
      success: false as const,
      error: "Errors.unauthorized",
      code: "FORBIDDEN" as const,
    };
  }

  const result = await bookingService.checkOut(bookingId);

  if (result.ok) {
    if (booking.guest?.email) {
      const locale = await getLocale();
      await notificationService.notifyCheckOut(booking.guest.email, booking.id, locale);
    }

    revalidatePartnerPaths();
    return { success: true as const };
  }

  return {
    success: false as const,
    error: result.message,
    code: result.code,
  };
}

/**
 * Esnaf / admin hesabına GSM (Netgsm bildirimleri için). Misafirlere SMS gönderilmez.
 */
export async function updatePartnerPhoneAction(phone: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Errors.authRequired" };
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    return { success: false as const, error: "Errors.notAuthorizedPartner" };
  }

  const trimmed = phone.trim();
  const normalized = normalizeTrGsm10(trimmed);
  if (trimmed && !normalized) {
    return {
      success: false as const,
      error: "Errors.invalidTrPhone",
    };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { phone: normalized },
    });
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e
        ? (e as { code?: string }).code
        : undefined;
    if (code === "P2002") {
      return {
        success: false as const,
        error: "Errors.phoneAlreadyRegistered",
      };
    }
    throw e;
  }

  revalidatePartnerPaths();
  return { success: true as const };
}

/**
 * Rezervasyon talebini onayla.
 */
export async function approveBookingAction(bookingId: string) {
  const session = await auth();
  if (session?.user?.role !== "PARTNER" && session?.user?.role !== "ADMIN") {
    return { success: false as const, error: "Errors.authRequired" };
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { shop: true, guest: { select: { email: true } } },
    });

    if (!booking) return { success: false as const, error: "Errors.bookingNotFound" };
    if (session.user.role === "PARTNER" && booking.shop.ownerId !== session.user.id) {
       return { success: false as const, error: "Errors.unauthorized" };
    }

    const updated = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        shopId: booking.shopId,
        status: BookingStatus.WAITING_APPROVAL,
      },
      data: {
        status: BookingStatus.APPROVED,
        bookingRowVersion: { increment: 1 },
      },
    });

    if (updated.count !== 1) {
      return { success: false as const, error: "Errors.bookingStateConflict" };
    }

    void bookingEventService.record({
      bookingId,
      event: "APPROVED",
      actorId: session.user.id,
      actorRole: session.user.role as "PARTNER" | "ADMIN",
    }).catch(() => {});

    if (booking.guest?.email) {
      const locale = await getLocale();
      void notificationService
        .notifyBookingApproved(booking.guest.email, bookingId, booking.shop.name, locale)
        .catch((err) => logger.error({ err, bookingId }, "notify_booking_approved_failed"));
    }

    revalidatePartnerPaths();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Errors.generic" };
  }
}

/**
 * Rezervasyon talebini reddet.
 */
export async function rejectBookingAction(bookingId: string) {
  const session = await auth();
  if (session?.user?.role !== "PARTNER" && session?.user?.role !== "ADMIN") {
    return { success: false as const, error: "Errors.authRequired" };
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { shop: true, guest: { select: { email: true } } },
    });

    if (!booking) return { success: false as const, error: "Errors.bookingNotFound" };
    if (session.user.role === "PARTNER" && booking.shop.ownerId !== session.user.id) {
       return { success: false as const, error: "Errors.unauthorized" };
    }

    // Partner sadece onay bekleyen talepleri reddedebilir; admin WAITING_APPROVAL veya APPROVED iptal edebilir
    if (booking.status === BookingStatus.APPROVED && session.user.role !== "ADMIN") {
      return { success: false as const, error: "Errors.unauthorized" };
    }
    if (booking.status !== BookingStatus.WAITING_APPROVAL && booking.status !== BookingStatus.APPROVED) {
      return { success: false as const, error: "Errors.bookingStateConflict" };
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });

    void bookingEventService.record({
      bookingId,
      event: "CANCELLED",
      actorId: session.user.id,
      actorRole: session.user.role as "PARTNER" | "ADMIN",
      metadata: { reason: session.user.role === "ADMIN" ? "cancelled_by_admin" : "rejected_by_partner" },
    }).catch(() => {});

    // Misafire "Reddedildi" e-postası
    if (booking.guest?.email) {
      const locale = await getLocale();
      void notificationService
        .notifyBookingCancelled(booking.guest.email, bookingId, booking.shop.name, locale)
        .catch((err) => logger.error({ err, bookingId }, "notify_booking_cancelled_failed"));
    }

    revalidatePartnerPaths();
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Errors.generic" };
  }
}

/**
 * Sıradaki uygun mühürleri getirir (Otomatik mühürleme için).
 */
export async function getNextAvailableSealsAction(shopId: string, count: number) {
  const session = await auth();
  if (session?.user?.role !== "PARTNER" && session?.user?.role !== "ADMIN") {
    return { success: false as const, error: "Errors.authRequired" };
  }

  // Sahiplik kontrolü: esnaf sadece kendi dükkanının mühürlerini görebilir
  if (session.user.role === "PARTNER") {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { ownerId: true },
    });
    if (!shop || shop.ownerId !== session.user.id) {
      return { success: false as const, error: "Errors.unauthorized" };
    }
  }

  const seals = await sealService.getNextAvailableSeals(shopId, count);
  return {
    success: true as const,
    seals: seals.map(s => ({ sealNumber: s.serialNumber })),
  };
}

/**
 * Bir mührü hatalı olarak işaretler ve stoktan düşer.
 */
export async function reportFaultySealAction(serialNumber: number, shopId: string) {
  const session = await auth();
  if (session?.user?.role !== "PARTNER" && session?.user?.role !== "ADMIN") {
    return { success: false as const, error: "Errors.authRequired" };
  }

  try {
    await sealService.markSealAsFaulty(serialNumber, shopId);
    return { success: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errors.generic";
    return { success: false as const, error: msg };
  }
}

/**
 * `extraAmount` BİLEREK YOK.
 *
 * Eskiden istemciden alınıyordu, yani esnaf misafire gösterilecek ek ücreti
 * kendisi yazabiliyordu ve sunucu hiç doğrulamıyordu. Fark artık sunucuda,
 * `computeAuthoritativeCheckoutTotals` ile hesaplanıyor — istemciden gelen tutar
 * varsa yok sayılır (P1-8).
 */
const pendingBagRevisionBodySchema = z.object({
  bookingId: z.string().uuid(),
  bagCountS: z.number().int().min(0).max(500),
  bagCountM: z.number().int().min(0).max(500),
  bagCountXl: z.number().int().min(0).max(500),
});

/**
 * Gerçek valiz sayısı / boyutu rezervasyondan farklıysa kayıt (ek ücret tahsilatı ayrı süreç).
 * PAID veya CHECKED_IN rezervasyonlarda güncellenebilir.
 */
export async function setPendingBagRevisionAction(raw: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Errors.authRequired" };
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    return { success: false as const, error: "Errors.notAuthorizedPartner" };
  }

  const parsed = pendingBagRevisionBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: "Errors.invalidData" };
  }
  const { bookingId, bagCountS, bagCountM, bagCountXl } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true },
  });
  if (!booking) {
    return { success: false as const, error: "Errors.bookingNotFound" };
  }
  if (
    session.user.role === "PARTNER" &&
    booking.shop.ownerId !== session.user.id
  ) {
    return { success: false as const, error: "Errors.unauthorized" };
  }
  if (booking.status !== "PAID" && booking.status !== "CHECKED_IN") {
    return { success: false as const, error: "Errors.invalidData" };
  }

  const total = bagCountS + bagCountM + bagCountXl;
  if (total < 1) {
    return { success: false as const, error: "Errors.invalidData" };
  }

  /**
   * Fark SUNUCUDA hesaplanıyor.
   *
   * Rezervasyonun kendi fiyat kuralları (anlık kopya) varsa onlar kullanılır —
   * o gün geçerli olan kural budur. Yoksa bugünküler; hangisinin kullanıldığı
   * revizyon kaydına yazılıyor ki sonradan sorgulanabilsin.
   */
  const snapshot = readPricingSnapshot(booking.pricingSnapshot);
  const rules = snapshot ?? (await getPricingRules());

  const unitPrice = moneyToNumber(booking.shop.pricePerDay);
  const before = computeAuthoritativeCheckoutTotals(
    unitPrice,
    booking.bagCountS,
    booking.bagCountM,
    booking.bagCountXl,
    booking.checkInTime,
    booking.checkOutTime,
    rules,
  );
  const after = computeAuthoritativeCheckoutTotals(
    unitPrice,
    bagCountS,
    bagCountM,
    bagCountXl,
    booking.checkInTime,
    booking.checkOutTime,
    rules,
  );
  const extraAmount =
    Math.round((after.subtotalBeforeCoupon - before.subtotalBeforeCoupon) * 100) / 100;

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      pendingBagRevision: {
        bagCountS,
        bagCountM,
        bagCountXl,
        /** Sunucuda hesaplandı. Negatif olabilir (valiz azaldıysa). */
        extraAmount,
        previousTotal: before.subtotalBeforeCoupon,
        newTotal: after.subtotalBeforeCoupon,
        /** Hangi kural kümesiyle hesaplandı — anlık kopya mı, bugünkü mü. */
        rulesSource: snapshot ? "booking_snapshot" : "current_platform_settings",
        recordedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  revalidatePartnerPaths();
  return { success: true as const, extraAmount };
}

/**
 * Revizyonu UYGULAR: yeni valiz sayılarını ve yeniden hesaplanan toplamı yazar.
 *
 * NEDEN VAR (P1-8): eskiden yalnızca `clearPendingBagRevisionAction` vardı ve o
 * revizyonu **siliyordu** — valiz sayıları ve `totalPrice` hiç güncellenmiyordu.
 * Yani bavul fiziksel olarak teslim alınıyor, kayıt eski hâlinde kalıyordu.
 * Prod'da bunun izi var: `S1 M3 XL1 → 540.00`, oysa aynı kurallarla 640 olmalıydı
 * — 100 TRY eksik, üstelik rezervasyon `CHECKED_IN`, yani 5 bavul teslim alınmış
 * ve 4'ü ödenmiş.
 *
 * Tek transaction: valiz sayıları ve toplam birlikte değişir, aralarında bir an
 * bile tutarsız kalmazlar.
 */
export async function applyPendingBagRevisionAction(bookingId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Errors.authRequired" };
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    return { success: false as const, error: "Errors.notAuthorizedPartner" };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true },
  });
  if (!booking) {
    return { success: false as const, error: "Errors.bookingNotFound" };
  }
  if (
    session.user.role === "PARTNER" &&
    booking.shop.ownerId !== session.user.id
  ) {
    return { success: false as const, error: "Errors.unauthorized" };
  }

  const revision = booking.pendingBagRevision as {
    bagCountS?: unknown;
    bagCountM?: unknown;
    bagCountXl?: unknown;
  } | null;
  if (
    !revision ||
    typeof revision.bagCountS !== "number" ||
    typeof revision.bagCountM !== "number" ||
    typeof revision.bagCountXl !== "number"
  ) {
    return { success: false as const, error: "Errors.invalidData" };
  }

  // Toplam SUNUCUDA yeniden hesaplanıyor; revizyon kaydındaki tutara güvenilmiyor.
  const snapshot = readPricingSnapshot(booking.pricingSnapshot);
  const rules = snapshot ?? (await getPricingRules());
  const totals = computeAuthoritativeCheckoutTotals(
    moneyToNumber(booking.shop.pricePerDay),
    revision.bagCountS,
    revision.bagCountM,
    revision.bagCountXl,
    booking.checkInTime,
    booking.checkOutTime,
    rules,
  );

  const previousTotal = moneyToNumber(booking.totalPrice);

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      bagCountS: totals.bagCountS,
      bagCountM: totals.bagCountM,
      bagCountXl: totals.bagCountXl,
      totalPrice: totals.subtotalBeforeCoupon,
      insuranceFee: totals.insuranceFee,
      pendingBagRevision: Prisma.JsonNull,
    },
  });

  await bookingEventService
    .record({
      bookingId,
      event: "BAGS_MODIFIED",
      actorId: session.user.id,
      actorRole: session.user.role,
      metadata: {
        from: {
          S: booking.bagCountS,
          M: booking.bagCountM,
          XL: booking.bagCountXl,
          total: previousTotal,
        },
        to: {
          S: totals.bagCountS,
          M: totals.bagCountM,
          XL: totals.bagCountXl,
          total: totals.subtotalBeforeCoupon,
        },
        delta: Math.round((totals.subtotalBeforeCoupon - previousTotal) * 100) / 100,
        rulesSource: snapshot ? "booking_snapshot" : "current_platform_settings",
        /**
         * Fark HENÜZ TAHSİL EDİLMEDİ. Sağlayıcı `manual` olduğu sürece tahsilat
         * dükkanda yapılır; ödeme defterine bağlanması ayrı iş (P1-21 ile aynı
         * boşluk). Bu alan operasyonun takip etmesi gereken şeydir.
         */
        settled: false,
      },
    })
    .catch((err) =>
      logger.error({ err, bookingId }, "bag_revision_apply_event_failed"),
    );

  revalidatePartnerPaths();
  return {
    success: true as const,
    newTotal: totals.subtotalBeforeCoupon,
    delta: Math.round((totals.subtotalBeforeCoupon - previousTotal) * 100) / 100,
  };
}

/**
 * Revizyonu REDDEDER: kaydı siler, rezervasyona DOKUNMAZ.
 *
 * Uygulamak için `applyPendingBagRevisionAction` kullanın. Bu ikisinin ayrı olması
 * bilinçli: eskiden tek bir "temizle" vardı ve o, uygulamak ile reddetmek arasında
 * ayrım yapmadan revizyonu yok ediyordu (P1-8).
 */
export async function clearPendingBagRevisionAction(bookingId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Errors.authRequired" };
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    return { success: false as const, error: "Errors.notAuthorizedPartner" };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true },
  });
  if (!booking) {
    return { success: false as const, error: "Errors.bookingNotFound" };
  }
  if (
    session.user.role === "PARTNER" &&
    booking.shop.ownerId !== session.user.id
  ) {
    return { success: false as const, error: "Errors.unauthorized" };
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { pendingBagRevision: Prisma.JsonNull },
  });

  revalidatePartnerPaths();
  return { success: true as const };
}

"use server";

import { auth } from "@/auth";
import { bookingService } from "@/services/BookingService";
import { notificationService } from "@/services/NotificationService";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { verifyQrToken } from "@/lib/qr-token";
import type { SealAssignmentInput } from "@/services/SealService";
import { normalizeTrGsm10 } from "@/lib/netgsm";

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
    return { success: false as const, error: "Oturum açmanız gerekiyor." };
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    return { success: false as const, error: "Bu işlem için esnaf yetkisi gerekir." };
  }

  let bookingId = raw.trim();
  const payload = await verifyQrToken(bookingId);
  if (payload) bookingId = payload.bookingId;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { guest: true, shop: true },
  });

  if (!booking) {
    return { success: false as const, error: "Rezervasyon bulunamadı." };
  }

  if (
    session.user.role === "PARTNER" &&
    booking.shop.ownerId !== session.user.id
  ) {
    return {
      success: false as const,
      error: "Bu rezervasyon sizin dükkanınıza ait değil.",
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
  };
}

/**
 * Check-out öncesi rezervasyona bağlı mühür listesi (onay ekranı).
 */
export async function getPartnerBookingSealsAction(bookingIdRaw: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Oturum açmanız gerekiyor." };
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    return { success: false as const, error: "Bu işlem için esnaf yetkisi gerekir." };
  }

  let bookingId = bookingIdRaw.trim();
  const payload = await verifyQrToken(bookingIdRaw);
  if (payload) bookingId = payload.bookingId;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true },
  });
  if (!booking) {
    return { success: false as const, error: "Rezervasyon bulunamadı." };
  }
  if (
    session.user.role === "PARTNER" &&
    booking.shop.ownerId !== session.user.id
  ) {
    return {
      success: false as const,
      error: "Bu rezervasyon sizin dükkanınıza ait değil.",
    };
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
  qrTokenOrBookingId: string,
  sealPhotoUrl: string | null,
  sealPayload: {
    sealAssignments: SealAssignmentInput[];
    faultySealNumbers: number[];
  }
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
    include: { shop: true },
  });
  if (!booking) {
    return {
      success: false as const,
      error: "Rezervasyon bulunamadı.",
      code: "NOT_FOUND" as const,
    };
  }

  if (session.user.role === "PARTNER" && booking.shop.ownerId !== session.user.id) {
    return {
      success: false as const,
      error: "Bu rezervasyon sizin dükkanınıza ait değil.",
      code: "FORBIDDEN" as const,
    };
  }

  const result = await bookingService.checkIn(
    bookingId,
    sealPhotoUrl,
    sealPayload
  );

  if (result.ok) {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { guest: true },
    });
    if (b?.guest?.email) {
      await notificationService.notifyCheckIn(b.guest.email, b.id);
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
    include: { shop: true },
  });
  if (!booking) {
    return {
      success: false as const,
      error: "Rezervasyon bulunamadı.",
      code: "NOT_FOUND" as const,
    };
  }
  if (session.user.role === "PARTNER" && booking.shop.ownerId !== session.user.id) {
    return {
      success: false as const,
      error: "Bu rezervasyon sizin dükkanınıza ait değil.",
      code: "FORBIDDEN" as const,
    };
  }

  const result = await bookingService.checkOut(bookingId);

  if (result.ok) {
    const updated = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { guest: true },
    });
    if (updated?.guest?.email) {
      await notificationService.notifyCheckOut(updated.guest.email, updated.id);
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
    return { success: false as const, error: "Oturum gerekli." };
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    return { success: false as const, error: "Yetkisiz." };
  }

  const trimmed = phone.trim();
  const normalized = normalizeTrGsm10(trimmed);
  if (trimmed && !normalized) {
    return {
      success: false as const,
      error: "Geçerli bir Türkiye GSM numarası girin (örn. 5xx xxx xx xx).",
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
        error: "Bu numara başka bir hesaba bağlı.",
      };
    }
    throw e;
  }

  revalidatePartnerPaths();
  return { success: true as const };
}

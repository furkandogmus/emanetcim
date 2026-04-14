"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { sealService } from "@/services/SealService";
import { notificationService } from "@/services/NotificationService";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";

// ─── Admin: kargo bilgisiyle talebi SHIPPED yap ──────────────────────────────

export async function shipSealRequestAction(params: {
  requestId: string;
  trackingNumber: string;
  serialFrom: number;
  serialTo: number;
  adminNote?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "unauthorized" };
  }

  const { requestId, trackingNumber, serialFrom, serialTo, adminNote } = params;

  if (!trackingNumber?.trim()) {
    return { success: false, error: "tracking_number_required" };
  }
  if (
    !Number.isInteger(serialFrom) ||
    !Number.isInteger(serialTo) ||
    serialFrom > serialTo
  ) {
    return { success: false, error: "invalid_serial_range" };
  }

  try {
    const sealRequest = await prisma.sealRequest.findUnique({
      where: { id: requestId },
      include: {
        shop: {
          include: { owner: { select: { email: true, phone: true } } },
        },
      },
    });

    if (!sealRequest) {
      return { success: false, error: "request_not_found" };
    }
    if (sealRequest.status !== "PENDING") {
      return { success: false, error: "request_not_pending" };
    }

    await prisma.sealRequest.update({
      where: { id: requestId },
      data: {
        status: "SHIPPED",
        trackingNumber: trackingNumber.trim(),
        serialFrom,
        serialTo,
        adminNote: adminNote?.trim() || null,
        updatedAt: new Date(),
      },
    });

    // Partner'a bildir
    const ownerEmail = sealRequest.shop.owner.email;
    const ownerPhone = sealRequest.shop.owner.phone;
    const shopName = sealRequest.shop.name;
    const subject = "BagajPark: Mühürleriniz Kargoya Verildi";
    const body = `Merhaba,\n\n${shopName} için talep ettiğiniz ${sealRequest.quantity} adet mühür kargoya verildi.\n\nTakip Numarası: ${trackingNumber.trim()}\nSeri Aralığı: ${serialFrom} - ${serialTo}\n${adminNote ? `\nNot: ${adminNote.trim()}` : ""}\n\nBagajPark`;

    if (ownerEmail) {
      await notificationService.sendEmail(ownerEmail, subject, body);
    }
    if (ownerPhone) {
      const sms = `BagajPark: Mühürleriniz kargoya verildi. Takip: ${trackingNumber.trim()}. Seri: ${serialFrom}-${serialTo}`;
      await notificationService.sendSms(ownerPhone, sms);
    }

    revalidatePathAllLocales("/admin/seals");
    revalidatePathAllLocales("/partner/seals");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

// ─── Partner: talebi DELIVERED yap + mühürleri ASSIGNED'a geçir ──────────────

export async function confirmSealDeliveryAction(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }

  try {
    const sealRequest = await prisma.sealRequest.findUnique({
      where: { id: requestId },
      include: { shop: { select: { ownerId: true } } },
    });

    if (!sealRequest) {
      return { success: false, error: "request_not_found" };
    }

    // Only the shop owner (or admin) can confirm delivery
    const role = session.user.role;
    if (
      role !== "ADMIN" &&
      sealRequest.shop.ownerId !== session.user.id
    ) {
      return { success: false, error: "unauthorized" };
    }

    if (sealRequest.status !== "SHIPPED") {
      return { success: false, error: "request_not_shipped" };
    }

    await prisma.sealRequest.update({
      where: { id: requestId },
      data: { status: "DELIVERED", updatedAt: new Date() },
    });

    // Assign seals if serial range is recorded
    if (
      sealRequest.serialFrom !== null &&
      sealRequest.serialTo !== null
    ) {
      await sealService.assignSealsToShop(
        sealRequest.shopId,
        sealRequest.serialFrom,
        sealRequest.serialTo
      );
    }

    revalidatePathAllLocales("/admin/seals");
    revalidatePathAllLocales("/partner/seals");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

// ─── Partner: mühür talebi aç ────────────────────────────────────────────────

export async function requestSealsAction(
  quantity: number
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "unauthorized" };
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "ADMIN") {
    return { success: false, error: "unauthorized" };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) {
    return { success: false, error: "invalid_quantity" };
  }

  try {
    const shop = await prisma.shop.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true, name: true },
    });

    if (!shop) {
      return { success: false, error: "shop_not_found" };
    }

    const sealRequest = await prisma.sealRequest.create({
      data: {
        shopId: shop.id,
        quantity,
        status: "PENDING",
        requestedBy: session.user.id,
        autoGenerated: false,
      },
    });

    revalidatePathAllLocales("/admin/seals");
    revalidatePathAllLocales("/partner/seals");
    return { success: true, requestId: sealRequest.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

// ─── Admin: RETURNED mühürleri geri dönüştür ─────────────────────────────────

export async function recycleReturnedSealsAction(
  shopId: string
): Promise<{ success: boolean; recycled: number; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, recycled: 0, error: "unauthorized" };
  }

  // Admin can recycle any shop; partner can only recycle their own
  if (session.user.role !== "ADMIN") {
    if (session.user.role !== "PARTNER") {
      return { success: false, recycled: 0, error: "unauthorized" };
    }
    const shop = await prisma.shop.findFirst({
      where: { id: shopId, ownerId: session.user.id },
      select: { id: true },
    });
    if (!shop) {
      return { success: false, recycled: 0, error: "unauthorized" };
    }
  }

  try {
    const recycled = await sealService.recycleReturnedSeals(shopId);
    revalidatePathAllLocales("/admin/seals");
    revalidatePathAllLocales("/partner/seals");
    return { success: true, recycled };
  } catch (e) {
    return {
      success: false,
      recycled: 0,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

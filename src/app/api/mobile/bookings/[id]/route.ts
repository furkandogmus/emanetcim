import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const b = await bookingService.getBookingDetails(id);
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isOwner = b.guestId === auth.user.id;
  const isPartner = auth.user.role === "PARTNER" && b.shop.ownerId === auth.user.id;
  if (!isOwner && !isPartner && auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: b.id,
    shopId: b.shopId,
    shopName: b.shop.name,
    checkInTime: b.checkInTime,
    checkOutTime: b.checkOutTime,
    bagCountS: b.bagCountS,
    bagCountM: b.bagCountM,
    bagCountXl: b.bagCountXl,
    totalPrice: Number(b.totalPrice),
    status: b.status,
    qrCodeToken: b.qrCodeToken,
    guestName: b.guest.name,
    latitude: b.shop.latitude,
    longitude: b.shop.longitude,
    shopPhone: b.shop.phone,
    seals: b.seals.map((s) => ({
      sealNumber: s.sealNumber,
      bagIndex: s.bagIndex,
      bagSize: s.bagSize,
    })),
  });
}

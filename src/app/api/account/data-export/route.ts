import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * KVKK veri dışa aktarma (oturum açık kullanıcı).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [user, bookings, reviews, legalAcceptances] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        email: true,
        emailVerified: true,
        phone: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.booking.findMany({
      where: { guestId: userId },
      select: {
        id: true,
        status: true,
        shopId: true,
        checkInTime: true,
        checkOutTime: true,
        totalPrice: true,
        createdAt: true,
      },
    }),
    prisma.review.findMany({
      where: { guestId: userId },
      select: {
        id: true,
        bookingId: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    }),
    prisma.legalAcceptance.findMany({
      where: { userId },
      select: {
        documentKey: true,
        version: true,
        acceptedAt: true,
      },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user,
    bookings,
    reviews,
    legalAcceptances,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bagajpark-data-${userId.slice(0, 8)}.json"`,
    },
  });
}

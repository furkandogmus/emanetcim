import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { reviewService } from "@/services/ReviewService";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { bookingId, rating, comment } = body;

  if (!bookingId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, guestId: true, shopId: true, status: true },
  });

  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (booking.guestId !== auth.user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (booking.status !== "CHECKED_OUT") return NextResponse.json({ error: "booking_not_completed" }, { status: 400 });

  try {
    const review = await reviewService.addReview({
      bookingId,
      guestId: auth.user.id,
      shopId: booking.shopId,
      rating: Math.round(rating),
      comment: comment || undefined,
    });
    return NextResponse.json({ success: true, review: { id: review.id, rating: review.rating } });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "duplicate_review" }, { status: 409 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

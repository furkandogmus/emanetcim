import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { reviewService } from "@/services/ReviewService";
import prisma from "@/lib/db";
import { z } from "zod";

const reviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  /*
    Govde dogrulanir: once `req.json()` bozuk govdede firlatiyor, metin puan
    ("5") ya da sinirsiz yorum servise kadar gidip 500 `server_error`a
    donuyordu (2026-10-18). Yorum siniri mobil formla ayni (2000).
  */
  const parsed = reviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const { bookingId, rating, comment } = parsed.data;

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
      rating,
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

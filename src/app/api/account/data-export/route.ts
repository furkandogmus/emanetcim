import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";

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

  /*
    HIZ SINIRI (2026-09-02'de eklendi). Bu uc TEK istekte kullanicinin butun
    gecmisini topluyor -- dort ayri sorgu, hicbirinde `take` yok. Kimlik
    dogrulamasi var, yani veri sizmiyor; sinirsiz olan sey MALIYET: ayni oturum
    ucu istedigi kadar cagirabiliyordu ve her cagri veritabanina dort tam tarama
    demek.

    Kod tabanindaki butun hassas/agir uclar (auth, OTP, parola sifirlama, arama
    yenileme) zaten bu kapidan geciyor; burasi atlanmisti. Sinir kullanici
    basina: KVKK ihracati insan hizinda bir istek, dakikada birden fazlasinin
    mesru karsiligi yok.
  */
  const ip = await getClientIp();
  if (!(await rateLimit(`data-export:${userId}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!(await rateLimit(`data-export:ip:${ip}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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

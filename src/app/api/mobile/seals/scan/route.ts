import { canOperateBookingAtShop, canOperateSealAtShop } from "@/services/booking/access";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import prisma from "@/lib/db";
import { countStaffShops } from "@/lib/shop-access";
import { verifyQrToken } from "@/lib/qr-token";

const schema = z.object({ code: z.string().min(1) });

/**
 * Esnaf QR tarama: iki mod
 *   1. Booking QR token → booking detayı döndür (check-in/out için)
 *   2. Seal serial (sayı) → seal kaydı döndür
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  // Personel PARTNER degildir; kaba kapi "dukkan tarafinda mi", asil kontrol kayit basina asagida.
  const forbid = requireRole(auth.user, ["PARTNER", "ADMIN"]);
  if (forbid && (await countStaffShops(auth.user.id)) === 0) return forbid;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { code } = parsed.data;

  // 1. Seal serial number (numeric)
  const serial = Number(code);
  if (Number.isInteger(serial) && serial > 0) {
    const seal = await prisma.seal.findUnique({
      where: { serialNumber: serial },
      include: { shop: { select: { id: true, ownerId: true } } },
    });
    if (seal) {
      // Sahiplik kontrolu: bkz. `canOperateSealAtShop` — 2026-09-10'da
      // bulunan IDOR (herhangi bir PARTNER, seri numarasi deneyerek baska
      // dukkanlarin muhur envanterini gorebiliyordu).
      if (!(await canOperateSealAtShop(seal, auth.user))) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      return NextResponse.json({
        type: "seal",
        serialNumber: seal.serialNumber,
        status: seal.status,
        shopId: seal.shopId,
        assignedAt: seal.assignedAt,
      });
    }
  }

  // 2. Booking QR token: once imzali yol, sonra kayitli token ile ESLESME.
  try {
    /*
      Imza suresi dolmus (ya da eski surumde 48 saatle sinirli uretilmis) ama
      veritabaninda KAYITLI olan token da gecerlidir: misafirin elindeki bilet
      rezervasyona ait tek kimlik bilgisidir ve tam eslesme onu kanitlar.
      Eskiden yalnizca imzaya bakiliyordu; 2 gunden once alinan rezervasyonun
      bileti teslim gununde "BagajPark QR'i degil" cikiyordu.
      `temp_` onekli degerler olusturma sirasindaki gecici yer tutucudur.
    */
    const payload = await verifyQrToken(code);
    const lookup = payload?.bookingId
      ? { id: payload.bookingId }
      : code.startsWith("temp_")
        ? null
        : { qrCodeToken: code };
    const booking = lookup
      ? await prisma.booking.findUnique({
          where: lookup,
          include: { shop: true, guest: { select: { name: true } } },
        })
      : null;
    if (booking) {
      // Dukkan operasyonu: kural `booking/access.ts`te, uc yerde degil.
      if (!(await canOperateBookingAtShop(booking, auth.user))) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      return NextResponse.json({
        type: "booking",
        id: booking.id,
        status: booking.status,
        shopName: booking.shop.name,
        guestName: booking.guest?.name ?? booking.guestName ?? "",
        checkInTime: booking.checkInTime,
        checkOutTime: booking.checkOutTime,
      });
    }
    if (payload?.bookingId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch {
    // ignore
  }

  return NextResponse.json({ error: "unknown_code" }, { status: 404 });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";
import type { BagRevisionErrorCode } from "@/services/BookingService";

/**
 * Esnaf: gercek valiz sayisini mobilden duzeltir (tek adimli akis).
 *
 * Govde `BookingService.applyBagRevision`'da; web'in iki adimli akisi (oner ->
 * uygula) AYNI govdeyi kullanir. Bu uc 2026-08-25'e kadar kendi hesabini ve kendi
 * `prisma.booking.update`'ini yaziyordu; web'den UC noktada ayrisimisti:
 *
 *   - durum kosulu tersti (`APPROVED|PAID` vs `PAID|CHECKED_IN`), yani ayni islem
 *     bir tasiyicida kabul edilip digerinde reddediliyordu,
 *   - `pendingBagRevision` TEMIZLENMIYORDU: web'den onerilmis bekleyen bir revizyon
 *     mobil duzeltmeden sonra kayitta kaliyor ve tekrar uygulanabiliyordu,
 *   - `unitPrice` yaziliyordu, web'de yazilmiyordu.
 */
const CODE_TO_HTTP: Record<BagRevisionErrorCode, { status: number; error: string }> = {
  NOT_FOUND: { status: 404, error: "not_found" },
  FORBIDDEN: { status: 403, error: "forbidden" },
  INVALID_STATUS: { status: 400, error: "invalid_status" },
  INVALID_COUNTS: { status: 400, error: "at_least_one_bag" },
  NO_PENDING_REVISION: { status: 400, error: "no_bag_counts" },
  /*
    409: istek gecerli ama kaynagin SU ANKI durumu kabul etmiyor -- ayni
    gerekce `checkout/intent`teki `CAPACITY_EXCEEDED` icin de yazili. Valiz
    sayisi dusurulurse ya da baska bir rezervasyon dusunce ayni istek calisir.
  */
  CAPACITY_EXCEEDED: { status: 409, error: "insufficient_capacity" },
  UNKNOWN: { status: 500, error: "server_error" },
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const asCount = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined);
  const s = asCount(body.bagCountS);
  const m = asCount(body.bagCountM);
  const xl = asCount(body.bagCountXl);

  if (s === undefined && m === undefined && xl === undefined) {
    return NextResponse.json({ error: "no_bag_counts" }, { status: 400 });
  }

  /*
    Mobil istemci yalnizca DEGISEN boyutu gonderebiliyor; eksik alanlar mevcut
    degerden tamamlanir. Bu yuzden once rezervasyonun bugunku sayilari okunur.
  */
  const current = await bookingService.getBookingDetails(id);
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result = await bookingService.applyBagRevision(
    id,
    { id: auth.user.id, role: "PARTNER" },
    {
      counts: {
        bagCountS: s ?? current.bagCountS,
        bagCountM: m ?? current.bagCountM,
        bagCountXl: xl ?? current.bagCountXl,
      },
      source: "mobile",
    },
  );

  if (!result.ok) {
    const { status, error } = CODE_TO_HTTP[result.code];
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ success: true, newTotal: result.newTotal });
}

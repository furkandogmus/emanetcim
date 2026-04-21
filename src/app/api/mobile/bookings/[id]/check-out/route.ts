import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { bookingService } from "@/services/BookingService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  
  const forbid = requireRole(auth.user, ["PARTNER", "ADMIN"]);
  if (forbid) return forbid;

  const { id } = await params;

  const result = await bookingService.checkOut(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: 400 });
  }

  return NextResponse.json({ 
    ok: true, 
    refundPending: result.refundPending, 
    refundAmount: result.refundAmount 
  });
}

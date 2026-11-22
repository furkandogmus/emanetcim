import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminPayments } from "@/lib/mobile-dto";
import { getPaymentsLedger } from "@/services/AdminPaymentsService";

/** GET `?status=` -> odeme defteri. SALT OKUNUR: para yalniz `PaymentService` ile degisir. */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;
  const ledger = await getPaymentsLedger(req.nextUrl.searchParams.get("status"));
  return NextResponse.json(toMobileAdminPayments(ledger));
}

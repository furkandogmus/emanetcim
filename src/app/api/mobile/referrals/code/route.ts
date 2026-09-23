import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { getReferralDiscountPct, referralService } from "@/services/ReferralService";

/**
 * Kullanicinin paylasacagi davet kodu ve arkadasina saglayacagi indirim orani.
 *
 * 2026-09-23: kod yoksa 404 donuyordu ve mobil ekran yerine var olmayan
 * `BP-WELCOME` kodunu gosteriyordu. Web ile ayni sekilde artik uretiliyor;
 * oran da buradan geliyor (mobil metin "₺20" diye sabit yaziyordu).
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const code = await referralService.getOrCreateCode(auth.user.id);
  if (!code) {
    return NextResponse.json({ error: "referral_code_failed" }, { status: 500 });
  }

  return NextResponse.json({ code, discountPct: getReferralDiscountPct() });
}

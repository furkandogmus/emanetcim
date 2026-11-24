import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyWalletLinkToken } from "@/lib/wallet/link-token";
import { notFound, walletRateLimit } from "@/lib/wallet/http";
import { walletPassService } from "@/services/WalletPassService";

/** "Google Cuzdan'a kaydet": imzali bagdan Google'in kaydetme sayfasina yonlendirir. */
export async function GET(req: NextRequest) {
  const limited = await walletRateLimit(req, "google-link", 30, 10 * 60_000);
  if (limited) return limited;
  if (!walletPassService.capabilities().walletGoogle) return notFound();
  const bookingId = await verifyWalletLinkToken(req.nextUrl.searchParams.get("t") ?? "", "google");
  if (!bookingId) return NextResponse.json({ error: "invalid_token" }, { status: 403 });
  const url = await walletPassService.googleSaveUrlFor(bookingId);
  if (!url) return notFound();
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyWalletLinkToken } from "@/lib/wallet/link-token";
import { notFound, walletRateLimit } from "@/lib/wallet/http";
import { walletPassService } from "@/services/WalletPassService";

/**
 * "Apple Cuzdan'a ekle" bagi: imzali, suresi dolan token (`?t=`), rezervasyon
 * kimligi tek basina yetmez. Safari `.pkpass` yanitini dogrudan Wallet'a verir.
 */
export async function GET(req: NextRequest) {
  const limited = await walletRateLimit(req, "apple-link", 30, 10 * 60_000);
  if (limited) return limited;
  if (!walletPassService.capabilities().walletApple) return notFound();
  const bookingId = await verifyWalletLinkToken(req.nextUrl.searchParams.get("t") ?? "", "apple");
  if (!bookingId) return NextResponse.json({ error: "invalid_token" }, { status: 403 });
  const built = await walletPassService.buildApplePass(bookingId);
  if (!built) return notFound();
  return new NextResponse(new Uint8Array(built.pass), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="bagajpark.pkpass"`,
      "Cache-Control": "no-store",
      "Last-Modified": built.lastModified.toUTCString(),
    },
  });
}

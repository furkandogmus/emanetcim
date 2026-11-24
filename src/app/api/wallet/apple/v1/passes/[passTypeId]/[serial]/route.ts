import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyPassAuthorization } from "@/lib/wallet/link-token";
import { notFound, passTypeMatches, walletRateLimit } from "@/lib/wallet/http";
import { walletPassService } from "@/services/WalletPassService";

/** PassKit: kartin guncel hali (push'tan sonra cihaz buradan ceker). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ passTypeId: string; serial: string }> },
) {
  const limited = await walletRateLimit(req, "ws", 120, 60_000);
  if (limited) return limited;
  const { passTypeId, serial } = await params;
  if (!passTypeMatches(passTypeId)) return notFound();
  if (!verifyPassAuthorization(req.headers.get("authorization"), serial)) {
    return new NextResponse(null, { status: 401 });
  }
  const built = await walletPassService.buildApplePass(serial);
  if (!built) return notFound();
  const since = Date.parse(req.headers.get("if-modified-since") ?? "");
  // HTTP tarihi saniye hassasiyetinde: milisaniyeyi atmadan karsilastirmak her seferinde 200 dondururdu.
  if (Number.isFinite(since) && Math.floor(built.lastModified.getTime() / 1000) * 1000 <= since) {
    return new NextResponse(null, { status: 304 });
  }
  return new NextResponse(new Uint8Array(built.pass), {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Last-Modified": built.lastModified.toUTCString(),
      "Cache-Control": "no-store",
    },
  });
}

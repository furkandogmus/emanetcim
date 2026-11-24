import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { notFound, passTypeMatches, validDeviceId, walletRateLimit } from "@/lib/wallet/http";
import { walletPassService } from "@/services/WalletPassService";

/**
 * PassKit: bu cihazin kartlarindan degisenler. Apple bu uca kimlik basligi
 * gondermez; yanit yalnizca seri numarasi listesi, kartin kendisi kimlikli uctan gelir.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string; passTypeId: string }> },
) {
  const limited = await walletRateLimit(req, "ws", 120, 60_000);
  if (limited) return limited;
  const { deviceId, passTypeId } = await params;
  if (!passTypeMatches(passTypeId) || !validDeviceId(deviceId)) return notFound();
  const result = await walletPassService.updatedSerials(deviceId, req.nextUrl.searchParams.get("passesUpdatedSince"));
  if (!result) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result);
}

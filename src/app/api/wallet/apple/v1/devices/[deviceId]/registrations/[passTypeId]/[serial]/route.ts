import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyPassAuthorization } from "@/lib/wallet/link-token";
import { notFound, passTypeMatches, validDeviceId, walletRateLimit } from "@/lib/wallet/http";
import { walletPassService } from "@/services/WalletPassService";

type Params = { params: Promise<{ deviceId: string; passTypeId: string; serial: string }> };

/** PassKit: cihaz karti kaydeder (guncelleme push'u icin token birakir). */
export async function POST(req: NextRequest, { params }: Params) {
  const limited = await walletRateLimit(req, "ws", 120, 60_000);
  if (limited) return limited;
  const { deviceId, passTypeId, serial } = await params;
  if (!passTypeMatches(passTypeId) || !validDeviceId(deviceId)) return notFound();
  if (!verifyPassAuthorization(req.headers.get("authorization"), serial)) {
    return new NextResponse(null, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { pushToken?: unknown } | null;
  const pushToken = typeof body?.pushToken === "string" ? body.pushToken.trim() : "";
  if (!/^[A-Za-z0-9]{1,200}$/.test(pushToken)) return new NextResponse(null, { status: 400 });
  const status = await walletPassService.registerDevice(deviceId, serial, pushToken);
  if (!status) return notFound();
  return new NextResponse(null, { status });
}

/** PassKit: kart cihazdan silindi. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const limited = await walletRateLimit(req, "ws", 120, 60_000);
  if (limited) return limited;
  const { deviceId, passTypeId, serial } = await params;
  if (!passTypeMatches(passTypeId) || !validDeviceId(deviceId)) return notFound();
  if (!verifyPassAuthorization(req.headers.get("authorization"), serial)) {
    return new NextResponse(null, { status: 401 });
  }
  await walletPassService.unregisterDevice(deviceId, serial);
  return new NextResponse(null, { status: 200 });
}

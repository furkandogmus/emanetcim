import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import logger from "@/lib/logger";
import { walletRateLimit } from "@/lib/wallet/http";
import { readAppleWalletConfig } from "@/lib/wallet/config";

/** PassKit: cihazin hata kaydi (yanlis imza, erisilemeyen uc). Kisaltilmis olarak loglanir. */
export async function POST(req: NextRequest) {
  const limited = await walletRateLimit(req, "ws-log", 20, 60_000);
  if (limited) return limited;
  if (!readAppleWalletConfig()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { logs?: unknown } | null;
  const logs = Array.isArray(body?.logs)
    ? body.logs.filter((l): l is string => typeof l === "string").slice(0, 10).map((l) => l.slice(0, 500))
    : [];
  if (logs.length > 0) logger.warn({ logs }, "wallet_apple_device_log");
  return new NextResponse(null, { status: 200 });
}

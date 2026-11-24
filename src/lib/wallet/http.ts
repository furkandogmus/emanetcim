import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-ip";
import { rateLimit } from "@/lib/rate-limit";
import { readAppleWalletConfig } from "@/lib/wallet/config";

/** IP basina sinir; asilirsa 429 yaniti, yoksa null. */
export async function walletRateLimit(req: Request, bucket: string, max: number, windowMs: number) {
  const ip = await getClientIp(req);
  const allowed = await rateLimit(`wallet:${bucket}:${ip}`, max, windowMs).catch(() => false);
  return allowed ? null : NextResponse.json({ error: "rate_limited" }, { status: 429 });
}

export function notFound() {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

/** PassKit web servisi: yapilandirma acik ve istenen tur bizim pass type id'miz mi. */
export function passTypeMatches(passTypeId: string): boolean {
  const cfg = readAppleWalletConfig();
  return !!cfg && cfg.passTypeId === passTypeId;
}

const DEVICE_ID = /^[A-Za-z0-9._-]{1,128}$/;
export function validDeviceId(id: string): boolean {
  return DEVICE_ID.test(id);
}

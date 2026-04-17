import { headers } from "next/headers";
import { NextRequest } from "next/server";

/**
 * BUG-17: Merkezi ve güvenli IP tespit metodu.
 */
export async function getClientIp(req?: NextRequest | Request): Promise<string> {
  let xForwardedFor: string | null = null;
  let xRealIp: string | null = null;

  if (req) {
    xForwardedFor = req.headers.get("x-forwarded-for");
    xRealIp = req.headers.get("x-real-ip");
  } else {
    const h = await headers();
    xForwardedFor = h.get("x-forwarded-for");
    xRealIp = h.get("x-real-ip");
  }

  if (xForwardedFor) {
    const ips = xForwardedFor.split(",");
    return ips[0].trim();
  }

  if (xRealIp) {
    return xRealIp.trim();
  }

  return "unknown";
}

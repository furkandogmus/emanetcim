import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** true = limit aşıldı, 429 dönmelisiniz */
export async function isRateLimited(
  req: NextRequest,
  keyPrefix: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const ip = clientIp(req);
  return !(await rateLimit(`${keyPrefix}:${ip}`, max, windowMs));
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyEmailToken, type VerifyEmailErrorCode } from "@/services/auth/verify-email";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";

/**
 * Servis kodunun mobil HTTP karsiligi. Bulunamayan / suresi dolan / hesapsiz token
 * tek yanit verir (bkz. `VerifyEmailErrorCode`).
 */
const CODE_TO_HTTP: Record<VerifyEmailErrorCode, { status: number; error: string }> = {
  INVALID_TOKEN: { status: 400, error: "invalid_or_expired_token" },
  UNKNOWN: { status: 500, error: "server_error" },
};

export async function POST(req: NextRequest) {
  /*
    HIZ SINIRI (2026-08-31): uc hicbir sinir tasimiyordu. Token bir UUID, yani
    tahmin edilemez -- ama sinirsiz bir uc, tahmin edilemezligi tek savunma
    yapar ve her denemeye bir veritabani sorgusu bedava verir.
  */
  const ip = clientIp(req);
  if (!(await rateLimit(`verify_email:ip:${ip}`, 20, 15 * 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const { token } = await req.json().catch(() => ({ token: undefined }));

  const result = await verifyEmailToken(token);
  if (!result.ok) {
    const { status, error } = CODE_TO_HTTP[result.code];
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ success: true });
}

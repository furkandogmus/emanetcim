import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";
import {
  consumePasswordResetToken,
  type PasswordResetErrorCode,
} from "@/services/auth/password-reset";

/** Servis kodu -> bu ucun DEGISMEYEN dis sozlesmesi (mobil istemci bunlari okuyor). */
const CODE_TO_HTTP: Record<PasswordResetErrorCode, { status: number; error: string }> = {
  INVALID_INPUT: { status: 400, error: "invalid_data" },
  INVALID_TOKEN: { status: 400, error: "invalid_or_expired_token" },
  EXPIRED: { status: 400, error: "invalid_or_expired_token" },
  USER_NOT_FOUND: { status: 404, error: "user_not_found" },
  UNKNOWN: { status: 500, error: "server_error" },
};

/**
 * Sifre sifirlama token'inin tuketilmesi — govde
 * `src/services/auth/password-reset.ts`'te, web action'iyla PAYLASILIYOR.
 * Ayrisma gecmisi ve alt sinirin neden 8'e cikarildigi orada yazili.
 *
 * HIZ SINIRI 2026-08-31'de eklendi: bu uc hicbir sinir tasimiyordu ve hesap
 * devralmaya en yakin uc — dogru token dogrudan yeni sifre yaziyor.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`password_reset_confirm:ip:${ip}`, 10, 15 * 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const result = await consumePasswordResetToken(body?.token, body?.password);

  if (!result.ok) {
    const { status, error } = CODE_TO_HTTP[result.code];
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ success: true });
}

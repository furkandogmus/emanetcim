import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/internal-api-guard";
import prisma from "@/lib/db";
import { signAccessToken, signRefreshToken } from "@/lib/mobile-auth";
import { toMobileUser } from "@/lib/mobile-dto";
import {
  consumePasswordResetCode,
  type PasswordResetCodeErrorCode,
} from "@/services/auth/password-reset";

/**
 * Mobil uygulamanin istemci sozlesmesi. `not_found` BILEREK yok: kaydi
 * olmayan e-posta `invalid_code` alir (hesap taramasi yok).
 */
const CODE_TO_HTTP: Record<PasswordResetCodeErrorCode, { status: number; error: string }> = {
  INVALID_CODE: { status: 400, error: "invalid_code" },
  EXPIRED_CODE: { status: 400, error: "expired_code" },
  TOO_MANY_ATTEMPTS: { status: 429, error: "too_many_attempts" },
  INVALID_PASSWORD: { status: 400, error: "invalid_password" },
  // `/auth/session` ile ayni kod: yasakli hesaba oturum verilmez.
  ACCOUNT_BANNED: { status: 403, error: "account_banned" },
  UNKNOWN: { status: 500, error: "server_error" },
};

/**
 * Kodla sifre sifirlama. Basarida `/auth/session` ile ayni govde doner;
 * eski oturumlar `tokenVersion` artisiyla zaten dusmustur.
 *
 * IP siniri kod basina 5 denemenin USTUNE: farkli e-postalara dagitilmis kaba
 * kuvvet. Ayni `too_many_attempts` kodu donulur, istemci "yeni kod iste" der.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`password_reset_code:ip:${ip}`, 20, 15 * 60_000))) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const result = await consumePasswordResetCode(body?.email, body?.code, body?.newPassword);
  if (!result.ok) {
    const { status, error } = CODE_TO_HTTP[result.code];
    return NextResponse.json({ error }, { status });
  }

  // `/auth/session` ile ayni govde (+ `success`): uygulama bunu giris yaniti gibi isler.
  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      image: true,
      emailVerified: true,
      passwordHash: true,
    },
  });
  return NextResponse.json({
    success: true,
    accessToken: await signAccessToken(result.userId, result.role, result.tokenVersion),
    refreshToken: await signRefreshToken(result.userId, result.role, result.tokenVersion),
    ...(user ? { user: toMobileUser(user) } : {}),
  });
}

import prisma from "@/lib/db";
import { hashPassword } from "@/lib/auth-password";
import {
  PASSWORD_RESET_IDENTIFIER_PREFIX,
  PASSWORD_RESET_PHONE_PREFIX,
  isPhoneResetIdentifier,
} from "@/lib/password-reset-token";
import logger from "@/lib/logger";

/**
 * Sifre sifirlama token'inin TUKETILMESI — tek govde.
 *
 * NEDEN AYRI BIR SERVIS (2026-08-31'de olculdu): ayni kural iki yerde ayri ayri
 * yaziliydi — `src/actions/password-reset.ts` (web) ve
 * `src/app/api/mobile/auth/password-reset/confirm/route.ts` (mobil) — ve
 * `CLAUDE.md`'nin one dedigi gibi KOPYALAR AYRISMISTI. Uc gercek fark vardi:
 *
 *   1. **Web `tokenVersion`'i ARTIRMIYORDU.** En agiri bu. Mobil kimlik
 *      durumsuz JWT ve iptalin tek yolu `tokenVersion`. Yani "sifrem calindi,
 *      web'den degistirdim" diyen bir kullanicinin telefonundaki saldirgan
 *      oturumu ayakta kaliyordu: access 15 dakika, **refresh 30 GUN**. Sifre
 *      sifirlamanin var olma amaci tam olarak budur ve web yolu onu yapmiyordu.
 *   2. **Alt sinir farkliydi**: web `min(8)`, mobil `>= 6`. Ayni hesap, hangi
 *      ekrandan girildigine gore farkli sifre gucu kabul ediyordu. Burada 8'de
 *      birlestirildi — yeni bir sifre BELIRLENIYOR, yani kimseyi disarida
 *      birakmaz.
 *   3. **Telefonla sifirlama** yalnizca web'de calisiyordu; mobil uc
 *      `password-reset:phone:` onekli token'i taniyip reddediyordu.
 *
 * Token TUKETILIR (silinir) ve `identifier` uzerinden silinir: ayni kimlik icin
 * eskiden kalmis baska bir satir varsa o da duser. Ikisi TEK transaction'da --
 * ayrilirlarsa ya sifre degisir token yasar (bag tekrar kullanilabilir) ya da
 * token olur sifre degismez (kullanici kilitlenir).
 */

export const MIN_NEW_PASSWORD_LENGTH = 8;
export const MAX_NEW_PASSWORD_LENGTH = 128;

export type PasswordResetErrorCode =
  | "INVALID_INPUT"
  | "INVALID_TOKEN"
  | "EXPIRED"
  | "USER_NOT_FOUND"
  | "UNKNOWN";

export type PasswordResetResult =
  | { ok: true; userId: string }
  | { ok: false; code: PasswordResetErrorCode };

export async function consumePasswordResetToken(
  rawToken: string | null | undefined,
  rawPassword: string | null | undefined,
): Promise<PasswordResetResult> {
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (
    !token ||
    password.trim().length < MIN_NEW_PASSWORD_LENGTH ||
    password.length > MAX_NEW_PASSWORD_LENGTH
  ) {
    return { ok: false, code: "INVALID_INPUT" };
  }

  try {
    const row = await prisma.verificationToken.findUnique({ where: { token } });

    const isResetIdentifier =
      !!row &&
      (row.identifier.startsWith(PASSWORD_RESET_IDENTIFIER_PREFIX) ||
        row.identifier.startsWith(PASSWORD_RESET_PHONE_PREFIX));

    if (!row || !isResetIdentifier) {
      return { ok: false, code: "INVALID_TOKEN" };
    }

    if (row.expires < new Date()) {
      // Temizlik basarisizligi akisi bozmaz ama gorunur olmali.
      await prisma.verificationToken
        .deleteMany({ where: { identifier: row.identifier } })
        .catch((err) => logger.error({ err }, "expired_reset_token_cleanup_failed"));
      return { ok: false, code: "EXPIRED" };
    }

    const user = isPhoneResetIdentifier(row.identifier)
      ? await prisma.user.findUnique({
          where: { phone: row.identifier.slice(PASSWORD_RESET_PHONE_PREFIX.length) },
          select: { id: true },
        })
      : await prisma.user.findUnique({
          where: { email: row.identifier.slice(PASSWORD_RESET_IDENTIFIER_PREFIX.length) },
          select: { id: true },
        });

    if (!user) {
      /*
        Token gecerliydi ama hesap yok (silinmis olabilir). Token yine de
        TUKETILIR: aksi halde ortalikta calisir durumda bir sifirlama bagi kalir.
      */
      await prisma.verificationToken
        .deleteMany({ where: { identifier: row.identifier } })
        .catch((err) => logger.error({ err }, "orphan_reset_token_cleanup_failed"));
      return { ok: false, code: "USER_NOT_FOUND" };
    }

    const passwordHash = await hashPassword(password);

    /*
      `tokenVersion` artisi bu islemin ASIL YARISI. Sifreyi degistirip eski
      token'lari ayakta birakmak, sifreyi hic degistirmemekten daha kotudur:
      kullanici korundugunu sanir.
    */
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      prisma.verificationToken.deleteMany({ where: { identifier: row.identifier } }),
    ]);

    return { ok: true, userId: user.id };
  } catch (err) {
    logger.error({ err }, "password_reset_consume_failed");
    return { ok: false, code: "UNKNOWN" };
  }
}

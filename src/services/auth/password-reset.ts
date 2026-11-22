import crypto from "crypto";
import type { Role } from "@prisma/client";
import prisma from "@/lib/db";
import {
  hashPassword,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@/lib/auth-password";
import {
  PASSWORD_RESET_IDENTIFIER_PREFIX,
  PASSWORD_RESET_PHONE_PREFIX,
  isPhoneResetIdentifier,
} from "@/lib/password-reset-token";
import logger from "@/lib/logger";
import { generatePasswordResetToken } from "@/lib/password-reset-token";
import {
  PASSWORD_RESET_CODE_MAX_ATTEMPTS,
  PASSWORD_RESET_CODE_TTL_MS,
  PASSWORD_RESET_CODE_WINDOW_MAX_FAILURES,
  PASSWORD_RESET_CODE_WINDOW_MS,
  generatePasswordResetCode,
  hashPasswordResetCode,
  isWellFormedResetCode,
  normalizeResetEmail,
  resetCodeMatches,
} from "@/lib/password-reset-code";
import { sendPasswordResetEmail } from "@/lib/mail";
import { markEmailVerifiedByCode } from "@/services/auth/verify-email";

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

/** Politika `src/lib/auth-password.ts`te; burasi yalnizca eski adi koruyor. */
export const MIN_NEW_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH;
export const MAX_NEW_PASSWORD_LENGTH = MAX_PASSWORD_LENGTH;

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
    const resetEmail = isPhoneResetIdentifier(row.identifier)
      ? null
      : row.identifier.slice(PASSWORD_RESET_IDENTIFIER_PREFIX.length);

    await applyPasswordReset(user.id, passwordHash, resetEmail, row.identifier);
    // E-postadaki baglanti adresin sahibini kanitlar (telefon bagi kanitlamaz).
    if (resetEmail) await markEmailVerifiedByCode(user.id);

    return { ok: true, userId: user.id };
  } catch (err) {
    logger.error({ err }, "password_reset_consume_failed");
    return { ok: false, code: "UNKNOWN" };
  }
}

/**
 * Bag ve kod yollarinin ORTAK kuyrugu: ikisi oturumlari ayni sekilde dusurur.
 *
 * `tokenVersion` artisi bu islemin ASIL YARISI. Sifreyi degistirip eski
 * token'lari ayakta birakmak, sifreyi hic degistirmemekten daha kotudur:
 * kullanici korundugunu sanir. Bag ve kod birlikte olur: biri kullanilinca
 * digeri yeniden kullanilamaz.
 */
async function applyPasswordReset(
  userId: string,
  passwordHash: string,
  email: string | null,
  identifier: string,
): Promise<{ tokenVersion: number }> {
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    }),
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    // Oturumu dusen cihazlar bildirim de almasin (bkz. `revokeAllUserSessions`).
    prisma.mobilePushToken.deleteMany({ where: { userId } }),
    ...(email ? [prisma.passwordResetCode.deleteMany({ where: { email } })] : []),
  ]);
  return { tokenVersion: updated.tokenVersion };
}

/** Pencereyi tasiyan satir bu kadar sonra silinir: daha erken silmek sayaci sifirlardi. */
const CODE_ROW_RETENTION_MS = PASSWORD_RESET_CODE_WINDOW_MS;
/** Istek basina en fazla bu kadar eski satir temizlenir (cron yok, sinirli is). */
const CLEANUP_BATCH = 100;

async function cleanupStaleResetCodes(now: Date): Promise<void> {
  const stale = await prisma.passwordResetCode.findMany({
    where: { expires: { lt: new Date(now.getTime() - CODE_ROW_RETENTION_MS) } },
    select: { email: true },
    take: CLEANUP_BATCH,
  });
  if (stale.length > 0) {
    await prisma.passwordResetCode.deleteMany({ where: { email: { in: stale.map((r) => r.email) } } });
  }
}

/**
 * Sifirlama ISTEGI -- web action'i ve mobil uc ayni govdeyi cagirir.
 *
 * HESAP TARAMASI YOK: hesabi olmayan e-posta icin de ayni bicimde bir kod
 * satiri (rastgele hash, kimseye gitmez) yazilir; onay ucu iki durumda da
 * ayni sirayla invalid_code / too_many_attempts / expired_code verir. Bag
 * uretimi ve e-posta atesle-unut: yanit suresi hesabin varligini soylemez.
 */
export async function requestPasswordReset(rawEmail: string, locale: string): Promise<void> {
  const email = normalizeResetEmail(rawEmail);
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { email }, select: { email: true } });
  await cleanupStaleResetCodes(now).catch((err) => logger.error({ err }, "reset_code_cleanup_failed"));

  const code = generatePasswordResetCode();
  // Sahte satirin hash'i hicbir koddan uretilemez: eslesme imkansiz.
  const codeHash = user?.email ? hashPasswordResetCode(email, code) : crypto.randomBytes(32).toString("hex");
  const codeRow = {
    codeHash,
    attempts: 0,
    expires: new Date(now.getTime() + PASSWORD_RESET_CODE_TTL_MS),
  };
  // Yeni istek eski kodu ve KOD sayacini ezer; 24 saatlik pencere sayaci korunur.
  await prisma.passwordResetCode.upsert({
    where: { email },
    create: { email, ...codeRow, windowStartedAt: now },
    update: codeRow,
  });

  if (!user?.email) return;
  const to = user.email;
  void (async () => {
    const row = await generatePasswordResetToken(to);
    await sendPasswordResetEmail(to, row.token, locale, code);
  })().catch((err) => logger.error({ err }, "password_reset_email_dispatch_failed"));
}

export type PasswordResetCodeErrorCode =
  | "INVALID_CODE"
  | "EXPIRED_CODE"
  | "TOO_MANY_ATTEMPTS"
  | "INVALID_PASSWORD"
  | "ACCOUNT_BANNED"
  | "UNKNOWN";

export type PasswordResetCodeResult =
  | { ok: true; userId: string; role: Role; tokenVersion: number }
  | { ok: false; code: PasswordResetCodeErrorCode };

/**
 * Kodla sifirlama (mobil). Bag yoluyla ayni sonuc: sifre yazilir, oturumlar
 * duser, e-posta dogrulanmis sayilir; cagiran yeni token ciftini uretir.
 *
 * Iki sinir, ikisi de KARSILASTIRMADAN ONCE atomik artirilir (es zamanli
 * tahminler asamaz): kod basina 5, e-posta basina 24 saatte 10. Sinira
 * ulasan yanlis ve sonrasi TOO_MANY_ATTEMPTS. Yasak kontrolu kod
 * eslestikten SONRA: kodu bilmeyen hesabin durumunu ogrenemez.
 */
export async function consumePasswordResetCode(
  rawEmail: unknown,
  rawCode: unknown,
  rawPassword: unknown,
): Promise<PasswordResetCodeResult> {
  const email = typeof rawEmail === "string" ? normalizeResetEmail(rawEmail) : "";
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!email || !isWellFormedResetCode(code)) return { ok: false, code: "INVALID_CODE" };
  // Sifre kurali denemeyi YAKMAZ: kullanici kodu dogru, sifreyi kisa yazmis olabilir.
  if (password.trim().length < MIN_NEW_PASSWORD_LENGTH || password.length > MAX_NEW_PASSWORD_LENGTH) {
    return { ok: false, code: "INVALID_PASSWORD" };
  }

  try {
    const now = new Date();
    // Suresi dolan pencere yeniden baslar (yalnizca eskiyse; atomik).
    await prisma.passwordResetCode.updateMany({
      where: { email, windowStartedAt: { lt: new Date(now.getTime() - PASSWORD_RESET_CODE_WINDOW_MS) } },
      data: { windowStartedAt: now, windowFailures: 0 },
    });

    const row = await prisma.passwordResetCode.findUnique({ where: { email } });
    if (!row) return { ok: false, code: "INVALID_CODE" };
    if (
      row.attempts >= PASSWORD_RESET_CODE_MAX_ATTEMPTS ||
      row.windowFailures >= PASSWORD_RESET_CODE_WINDOW_MAX_FAILURES
    ) {
      return { ok: false, code: "TOO_MANY_ATTEMPTS" };
    }
    // Satir silinmez: pencere sayaci onunla yasar (temizlik istek yolunda).
    if (row.expires < now) return { ok: false, code: "EXPIRED_CODE" };

    const claimed = await prisma.passwordResetCode.updateMany({
      where: {
        email,
        codeHash: row.codeHash,
        attempts: { lt: PASSWORD_RESET_CODE_MAX_ATTEMPTS },
        windowFailures: { lt: PASSWORD_RESET_CODE_WINDOW_MAX_FAILURES },
      },
      data: { attempts: { increment: 1 }, windowFailures: { increment: 1 } },
    });
    // Arada yeni kod istendi ya da es zamanli tahminler siniri doldurdu.
    if (claimed.count === 0) return { ok: false, code: "TOO_MANY_ATTEMPTS" };

    if (!resetCodeMatches(email, code, row.codeHash)) {
      const exhausted =
        row.attempts + 1 >= PASSWORD_RESET_CODE_MAX_ATTEMPTS ||
        row.windowFailures + 1 >= PASSWORD_RESET_CODE_WINDOW_MAX_FAILURES;
      return { ok: false, code: exhausted ? "TOO_MANY_ATTEMPTS" : "INVALID_CODE" };
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, isBanned: true },
    });
    if (!user) return { ok: false, code: "INVALID_CODE" };
    if (user.isBanned) return { ok: false, code: "ACCOUNT_BANNED" };

    // Tek tuketim: ayni dogru kodla gelen ikinci istek satiri bulamaz.
    const consumed = await prisma.passwordResetCode.deleteMany({ where: { email, codeHash: row.codeHash } });
    if (consumed.count !== 1) return { ok: false, code: "INVALID_CODE" };

    const passwordHash = await hashPassword(password);
    const { tokenVersion } = await applyPasswordReset(
      user.id,
      passwordHash,
      email,
      `${PASSWORD_RESET_IDENTIFIER_PREFIX}${email}`,
    );
    await markEmailVerifiedByCode(user.id);
    return { ok: true, userId: user.id, role: user.role, tokenVersion };
  } catch (err) {
    logger.error({ err }, "password_reset_code_consume_failed");
    return { ok: false, code: "UNKNOWN" };
  }
}

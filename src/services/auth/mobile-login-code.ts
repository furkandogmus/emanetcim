import crypto from "crypto";
import type { User } from "@prisma/client";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import {
  generatePasswordResetCode,
  hashScopedCode,
  isWellFormedResetCode,
  scopedCodeMatches,
} from "@/lib/password-reset-code";

/**
 * Mobil kodla GIRIS (e-posta OTP; SMS acilirsa ayni govde). Sifirlama kodunun
 * (`password-reset.ts`, `PasswordResetCode`) modeliyle ayni.
 *
 * NEDEN (2026-11-24 guvenlik incelemesi): kod `VerificationToken`a DUZ yaziliyordu
 * ve her istek ayri satir aciyordu (upsert anahtari kimlik+kod). Kimlik basina
 * 2 dakikada 3 istekle ayni anda ~9 kod gecerliydi, kod basina deneme sayaci yoktu
 * ve yanlis tahmin kodu yakmiyordu. Simdi:
 *
 *   - kimlik basina TEK aktif kod (yeni istek eskisini ezer),
 *   - yalnizca HMAC'i saklanir, sabit zamanli karsilastirilir,
 *   - kod basina 5 yanlis; 24 saatte kimlik+IP basina 10 deneme ve kimlik
 *     basina 50 yanlis tavan, hepsi karsilastirmadan ONCE artirilir. Tavan
 *     kimlik+IP'den yuksek: baska IP'den 10 yanlis kurbani kilitleyemez,
 *     6 hanede tek aktif kodla 50 tahmin yine ihmal edilebilir sans,
 *   - ADMIN hesabina kodla giris YOK: sifre (ve mevcut akis) zorunlu. Kod
 *     gonderilmez ama yanit ayni, hesabin rolu disaridan okunamaz.
 */

export const MOBILE_LOGIN_CODE_SCOPE = "mobile-login";
/** E-posta ve SMS metni "5 dakika" diyor. */
export const MOBILE_LOGIN_CODE_TTL_MS = 5 * 60 * 1000;
export const MOBILE_LOGIN_CODE_MAX_ATTEMPTS = 5;
export const MOBILE_LOGIN_CODE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Kimlik basina tavan (tum IP'ler); yeni kod istemek sifirlamaz. */
export const MOBILE_LOGIN_CODE_WINDOW_MAX_FAILURES = 50;
/** Kimlik+IP basina deneme (dogru kod dahil) siniri, ayni pencerede. */
export const MOBILE_LOGIN_CODE_IP_WINDOW_MAX_ATTEMPTS = 10;
const CLEANUP_BATCH = 100;

export type MobileLoginChannel = "email" | "phone";

/** Kodla giriste kimligin hesabi: e-posta birebir, telefon kayitli bicimlerden biri. */
export async function findUserByMobileIdentity(identity: string, channel: MobileLoginChannel): Promise<User | null> {
  if (channel === "email") return prisma.user.findUnique({ where: { email: identity } });
  return prisma.user.findFirst({
    where: { OR: [{ phone: identity }, { phone: `+90${identity}` }, { phone: `0${identity}` }] },
  });
}

/**
 * Google Play inceleme ekibi e-postaya erisemez: tek hesap sabit kodla girer.
 * Kod yine ayni satira, ayni sayaclarla yazilir; yalnizca hesap `reviewSandbox`
 * ve ADMIN degilse.
 */
function playReviewCode(identity: string): string | null {
  const email = process.env.PLAY_REVIEW_EMAIL?.trim().toLowerCase();
  const code = process.env.PLAY_REVIEW_OTP?.trim();
  if (!email || !code || !isWellFormedResetCode(code)) return null;
  return identity === email ? code : null;
}

function hashFor(identity: string, code: string): string {
  return hashScopedCode(MOBILE_LOGIN_CODE_SCOPE, identity, code);
}

async function cleanupStaleCodes(now: Date): Promise<void> {
  const stale = await prisma.mobileLoginCode.findMany({
    where: { expires: { lt: new Date(now.getTime() - MOBILE_LOGIN_CODE_WINDOW_MS) } },
    select: { identity: true },
    take: CLEANUP_BATCH,
  });
  if (stale.length > 0) {
    await prisma.mobileLoginCode.deleteMany({ where: { identity: { in: stale.map((r) => r.identity) } } });
  }
}

/** Gunluk temizlik isi: penceresi de dolmus satirlar (daha erken silmek sayaci sifirlardi). */
export async function purgeStaleMobileLoginCodes(now: Date = new Date()): Promise<number> {
  const res = await prisma.mobileLoginCode.deleteMany({
    where: { expires: { lt: new Date(now.getTime() - MOBILE_LOGIN_CODE_WINDOW_MS) } },
  });
  return res.count;
}

export type IssueMobileLoginCodeResult =
  /** Cagiran kodu e-posta/SMS ile gonderir. */
  | { kind: "deliver"; code: string }
  /** Play inceleme hesabi: sabit kod, gonderim yok. */
  | { kind: "review" }
  /** ADMIN hesabi: kod uretilmedi; yanit yine `ok` (rol sizmasin). */
  | { kind: "suppressed" };

export async function issueMobileLoginCode(
  identity: string,
  channel: MobileLoginChannel,
): Promise<IssueMobileLoginCodeResult> {
  const now = new Date();
  await cleanupStaleCodes(now).catch((err) => logger.error({ err }, "mobile_login_code_cleanup_failed"));

  const user = await findUserByMobileIdentity(identity, channel);
  let result: IssueMobileLoginCodeResult;
  let codeHash: string;

  const review = playReviewCode(identity);
  if (user?.role === "ADMIN") {
    // Eslesmesi imkansiz hash: dogrulama yolu ayni sirayla invalid_code verir.
    codeHash = crypto.randomBytes(32).toString("hex");
    result = { kind: "suppressed" };
    logger.warn({ userId: user.id }, "mobile_otp_admin_refused");
  } else if (review && user?.reviewSandbox) {
    codeHash = hashFor(identity, review);
    result = { kind: "review" };
    logger.info({ userId: user.id }, "mobile_otp_play_review_code_issued");
  } else {
    if (review) logger.warn({ userId: user?.id ?? null }, "mobile_otp_play_review_not_sandbox");
    const code = generatePasswordResetCode();
    codeHash = hashFor(identity, code);
    result = { kind: "deliver", code };
  }

  const row = {
    codeHash,
    attempts: 0,
    expires: new Date(now.getTime() + MOBILE_LOGIN_CODE_TTL_MS),
  };
  // Yeni istek eski kodu ve KOD sayacini ezer; 24 saatlik pencere sayaci korunur.
  await prisma.mobileLoginCode.upsert({
    where: { identity },
    create: { identity, ...row, windowStartedAt: now },
    update: row,
  });
  return result;
}

export type MobileLoginCodeErrorCode = "INVALID_CODE" | "TOO_MANY_ATTEMPTS" | "ADMIN_OTP_DISABLED";

export type VerifyMobileLoginCodeResult =
  /** `user: null` -> hesap yok, cagiran yeni misafir hesabi acar. */
  | { ok: true; user: User | null }
  | { ok: false; code: MobileLoginCodeErrorCode };

/**
 * Kodu dogrular ve TUKETIR. Bulunamayan, suresi dolan ve yanlis kod ayni
 * `INVALID_CODE`; sinir dolunca `TOO_MANY_ATTEMPTS`. Rol kontrolu kod
 * eslestikten SONRA: kodu bilmeyen hesabin rolunu ogrenemez.
 */
export async function verifyMobileLoginCode(
  identity: string,
  channel: MobileLoginChannel,
  rawCode: unknown,
  ip: string,
): Promise<VerifyMobileLoginCodeResult> {
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!identity || !isWellFormedResetCode(code)) return { ok: false, code: "INVALID_CODE" };
  if (
    !(await rateLimit(
      `mobile_login_code:${identity}:${ip}`,
      MOBILE_LOGIN_CODE_IP_WINDOW_MAX_ATTEMPTS,
      MOBILE_LOGIN_CODE_WINDOW_MS,
    ))
  ) {
    return { ok: false, code: "TOO_MANY_ATTEMPTS" };
  }

  const now = new Date();
  await prisma.mobileLoginCode.updateMany({
    where: { identity, windowStartedAt: { lt: new Date(now.getTime() - MOBILE_LOGIN_CODE_WINDOW_MS) } },
    data: { windowStartedAt: now, windowFailures: 0 },
  });

  const row = await prisma.mobileLoginCode.findUnique({ where: { identity } });
  if (!row) return { ok: false, code: "INVALID_CODE" };
  if (row.attempts >= MOBILE_LOGIN_CODE_MAX_ATTEMPTS || row.windowFailures >= MOBILE_LOGIN_CODE_WINDOW_MAX_FAILURES) {
    return { ok: false, code: "TOO_MANY_ATTEMPTS" };
  }
  if (row.expires < now) return { ok: false, code: "INVALID_CODE" };

  // Karsilastirmadan ONCE: es zamanli tahminler siniri asamaz.
  const claimed = await prisma.mobileLoginCode.updateMany({
    where: {
      identity,
      codeHash: row.codeHash,
      attempts: { lt: MOBILE_LOGIN_CODE_MAX_ATTEMPTS },
      windowFailures: { lt: MOBILE_LOGIN_CODE_WINDOW_MAX_FAILURES },
    },
    data: { attempts: { increment: 1 }, windowFailures: { increment: 1 } },
  });
  if (claimed.count === 0) return { ok: false, code: "TOO_MANY_ATTEMPTS" };

  if (!scopedCodeMatches(MOBILE_LOGIN_CODE_SCOPE, identity, code, row.codeHash)) {
    const exhausted =
      row.attempts + 1 >= MOBILE_LOGIN_CODE_MAX_ATTEMPTS ||
      row.windowFailures + 1 >= MOBILE_LOGIN_CODE_WINDOW_MAX_FAILURES;
    return { ok: false, code: exhausted ? "TOO_MANY_ATTEMPTS" : "INVALID_CODE" };
  }

  /*
    Tek tuketim, ama satir SILINMEZ: silmek pencere sayacini sifirlardi ve
    kurbanin her girisi saldirgana taze bir pencere verirdi. Hash eslesmez
    bir degerle ezilir; dogru deneme yanlis sayilmaz.
  */
  const consumed = await prisma.mobileLoginCode.updateMany({
    where: { identity, codeHash: row.codeHash },
    data: {
      codeHash: crypto.randomBytes(32).toString("hex"),
      // Gecmise: ayni milisaniyedeki istek de suresi dolmus gorur. Cok gecmise
      // degil: temizlik satiri pencereden once silmesin.
      expires: new Date(now.getTime() - 1),
      windowFailures: { decrement: 1 },
    },
  });
  if (consumed.count !== 1) return { ok: false, code: "INVALID_CODE" };

  const user = await findUserByMobileIdentity(identity, channel);
  if (user?.role === "ADMIN") {
    // Kod admin olmadan once istenmis olabilir; giris yine de kodla verilmez.
    logger.warn({ userId: user.id }, "mobile_otp_admin_login_refused");
    return { ok: false, code: "ADMIN_OTP_DISABLED" };
  }
  if (user && playReviewCode(identity) === code) {
    logger.info({ userId: user.id }, "mobile_otp_play_review_login");
  }
  return { ok: true, user };
}

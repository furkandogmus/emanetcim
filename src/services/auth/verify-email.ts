/**
 * E-posta doğrulama token'ının tüketilmesi.
 *
 * NEDEN AYRI BİR MODÜL (2026-08-25'te ölçüldü): bu kural **iki kez** yazılmıştı —
 * `src/app/[locale]/auth/verify-email/page.tsx` ve
 * `src/app/api/mobile/auth/verify-email/route.ts`. Otuz beş satır, kelimesi
 * kelimesine aynı: token bul → süresi geçti mi → kullanıcı bul → transaction.
 *
 * Henüz ayrışmamışlardı, ama bu tesadüf: aynı kuralı iki yere yazan diğer
 * çiftlerin **hepsi** ayrışmıştı (mobil "reddet" iadeyi atlıyordu, mobil "teslim
 * aldım" mühür atamıyordu, alıcı e-posta alanı iki tarafta farklıydı). Kimlik
 * doğrulama, ayrışmasını en pahalıya ödeyeceğimiz yer.
 *
 * İkisi de `console.error` kullanıyordu; proje yapılandırılmış `logger` istiyor
 * (`rules/observability`: yapılandırılmamış metin log yok).
 */
import prisma from "@/lib/db";
import logger from "@/lib/logger";

export type VerifyEmailErrorCode =
  | "INVALID_TOKEN"
  | "TOKEN_NOT_FOUND"
  | "TOKEN_EXPIRED"
  | "USER_NOT_FOUND"
  | "UNKNOWN";

export type VerifyEmailResult =
  | { ok: true; email: string }
  | { ok: false; code: VerifyEmailErrorCode };

/**
 * Token'ı tüketir: kullanıcıyı doğrulanmış yapar ve token'ı SİLER.
 *
 * İkisi TEK transaction'da. Ayrılırlarsa ya token tüketilmeden hesap doğrulanır
 * (aynı bağlantı tekrar kullanılabilir) ya da token silinip hesap doğrulanmaz
 * (kullanıcı kilitlenir ve yeni bağlantı istemek zorunda kalır).
 *
 * `email` alanı da yazılır: kullanıcı e-postasını DEĞİŞTİRDİĞİNDE doğrulama
 * bağlantısı yeni adrese gider ve onay, adresi de taşır.
 */
export async function verifyEmailToken(
  token: string | null | undefined,
): Promise<VerifyEmailResult> {
  const value = token?.trim();
  if (!value) return { ok: false, code: "INVALID_TOKEN" };

  try {
    const existingToken = await prisma.verificationToken.findUnique({
      where: { token: value },
    });
    if (!existingToken) return { ok: false, code: "TOKEN_NOT_FOUND" };

    if (new Date(existingToken.expires) < new Date()) {
      return { ok: false, code: "TOKEN_EXPIRED" };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: existingToken.identifier },
    });
    if (!existingUser) return { ok: false, code: "USER_NOT_FOUND" };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: existingUser.id },
        data: { emailVerified: new Date(), email: existingToken.identifier },
      }),
      prisma.verificationToken.delete({ where: { token: value } }),
    ]);

    return { ok: true, email: existingToken.identifier };
  } catch (err) {
    logger.error({ err }, "verify_email_token_failed");
    return { ok: false, code: "UNKNOWN" };
  }
}

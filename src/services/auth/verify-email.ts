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
import { linkGuestBookingsToVerifiedUser } from "@/services/booking/guest-link";

/**
 * Bulunamayan, suresi dolan ve hesabi olmayan token TEK kod (`INVALID_TOKEN`).
 * Ayri kodlar bir kahin (oracle) idi: `VerificationToken` baska akislarin
 * satirlarini da tutar ve "hesap yok" yaniti, baska turden bir token'in CANLI
 * oldugunu soyluyordu (2026-11-24 guvenlik incelemesi).
 */
export type VerifyEmailErrorCode = "INVALID_TOKEN" | "UNKNOWN";

/** Dogrulama satirinin kimligi ham e-postadir; onekli (`mobile:`, `password-reset:`) satirlar degil. */
function isEmailVerificationIdentifier(identifier: string): boolean {
  return identifier.includes("@") && !identifier.includes(":");
}

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
    if (!existingToken || !isEmailVerificationIdentifier(existingToken.identifier)) {
      return { ok: false, code: "INVALID_TOKEN" };
    }
    if (new Date(existingToken.expires) < new Date()) return { ok: false, code: "INVALID_TOKEN" };

    const existingUser = await prisma.user.findUnique({
      where: { email: existingToken.identifier },
    });
    if (!existingUser) return { ok: false, code: "INVALID_TOKEN" };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: existingUser.id },
        data: { emailVerified: new Date(), email: existingToken.identifier },
      }),
      prisma.verificationToken.delete({ where: { token: value } }),
    ]);

    // Adres kanitlandi: ayni e-postayla yapilmis hesapsiz rezervasyonlar baglanir.
    await linkGuestBookingsToVerifiedUser(existingUser.id);
    return { ok: true, email: existingToken.identifier };
  } catch (err) {
    logger.error({ err }, "verify_email_token_failed");
    return { ok: false, code: "UNKNOWN" };
  }
}

/**
 * E-postaya gelen kodla giris, adresin sahibi oldugunu kanitlar: kodu alan kisi
 * o kutuya erisiyor. Mobil OTP girisi bunu hic isaretlemiyordu; kodla giren her
 * misafir "dogrulanmamis" kaliyordu (2026-10-18). Yalnizca bos alani doldurur.
 *
 * Zaten dogrulanmis hesapta da cagrilir: aradaki hesapsiz rezervasyonlar baglanir.
 */
export async function markEmailVerifiedByCode(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, emailVerified: null },
    data: { emailVerified: new Date() },
  });
  await linkGuestBookingsToVerifiedUser(userId);
}

/**
 * Google/Apple'in DOGRULANMIS dedigi e-posta da kanittir: ayni isaretleme ve
 * hesapsiz rezervasyon baglama. Cagiran yalnizca saglayicinin dogrulanmis
 * iddiasi bu hesabin e-postasiyla eslesince cagirir.
 */
export async function markEmailVerifiedByProvider(userId: string): Promise<void> {
  // Girisi dusurmez: token zaten dogrulandi, isaret bir sonraki giriste tekrar denenir.
  await markEmailVerifiedByCode(userId).catch((err) =>
    logger.error({ err, userId }, "provider_email_verify_mark_failed"),
  );
}

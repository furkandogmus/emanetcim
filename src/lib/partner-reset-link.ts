import { scryptSync } from "crypto";
import { generatePasswordResetTokenByPhone } from "@/lib/password-reset-token";
import { getSiteBaseUrl } from "@/lib/site-urls";

/**
 * Esnafa elden (WhatsApp/telefon) iletilen şifre belirleme bağı — tek yer.
 *
 * İki çağıranı var: admin'in mevcut esnaf için başlattığı sıfırlama
 * (`adminInitiatePartnerPasswordResetAction`) ve admin'in esnaf adına hesap
 * açması (`adminCreatePartnerAction`). İkincisinde hesap ŞİFRESİZ açılıyor;
 * esnaf şifresini bu bağla kendisi belirliyor, yani şifre hiçbir an admin'in
 * elinden geçmiyor.
 */
export type PartnerResetLink = {
  resetUrl: string;
  /** Denetim kaydı için: token'ın kendisi DEĞİL (bkz. `tokenFingerprint`). */
  tokenFingerprint: string;
  expiresAt: Date;
};

/**
 * Token'in KENDISI degil, ona isaret eden geri donusu olmayan bir parmak izi.
 *
 * Denetim kaydinin cevaplamasi gereken soru "hangi yonetici, kime, ne zaman bir
 * sifirlama baslatti" -- token'in degeri buna hicbir sey katmaz. Parmak izi,
 * sonradan "su kayittaki sifirlama su token'la mi yapildi" sorusunu yanitlamayi
 * mumkun kiliyor, ama tersine cevrilip parolayi degistirmek icin kullanilamaz.
 */
export function tokenFingerprint(token: string): string {
  /*
    scrypt, sha256 DEGIL (2026-09-30): CodeQL `js/insufficient-password-hash`
    sha256'yi bir sifre ozeti sanip PR'i kirmiziya ceviriyordu (main'de #17).
    Token rastgele bir UUID, sifre degil; yani sha256 da guvenliydi. scrypt
    kuralin yeterli saydigi algoritmalardan, cikti yine 12 hex hane ve bir
    admin isleminde birkac ms'lik maliyet onemsiz. Sabit tuz bilincli: parmak izi
    ayni token icin her zaman ayni olmali ki kayitlar karsilastirilabilsin.
  */
  return scryptSync(token, "partner-reset-link:audit", 6).toString("hex");
}

/** `phone` normalize edilmiş 10 haneli biçimde (`normalizeTrGsm10`) gelir. */
export async function createPartnerResetLink(phone: string): Promise<PartnerResetLink> {
  const row = await generatePasswordResetTokenByPhone(phone);
  /*
    Taban adres ortak yardimciyla (`getSiteBaseUrl`) aliniyor. Onceden bu kod
    kendi yedegini yaziyordu ve YALNIZCA `NEXT_PUBLIC_APP_URL`e bakiyordu;
    projenin geri kalani once `NEXT_PUBLIC_BASE_URL`i okuyor. Yani yalnizca
    ikincisi tanimliysa yonetici, `localhost:3000` isaret eden bir bag alip
    esnafa gonderiyordu -- ve bunun yanlis oldugunu ancak esnaf tiklayinca
    ogreniyordu.
  */
  return {
    resetUrl: `${getSiteBaseUrl()}/tr/auth/new-password?token=${row.token}`,
    tokenFingerprint: tokenFingerprint(row.token),
    expiresAt: row.expires,
  };
}

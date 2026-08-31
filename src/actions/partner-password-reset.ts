"use server";

import prisma from "@/lib/db";
import { normalizeTrGsm10 } from "@/lib/netgsm";
import { generatePasswordResetTokenByPhone } from "@/lib/password-reset-token";
import { writeAuditLog } from "@/lib/audit-log";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/action-auth";
import { getSiteBaseUrl } from "@/lib/site-urls";
import { createHash } from "crypto";

/**
 * Token'in KENDISI degil, ona isaret eden geri donusu olmayan bir parmak izi.
 *
 * Denetim kaydinin cevaplamasi gereken soru "hangi yonetici, kime, ne zaman bir
 * sifirlama baslatti" -- token'in degeri buna hicbir sey katmaz. Parmak izi,
 * sonradan "su kayittaki sifirlama su token'la mi yapildi" sorusunu yanitlamayi
 * mumkun kiliyor, ama tersine cevrilip parolayi degistirmek icin kullanilamaz.
 */
function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}

/**
 * Admin: partner telefonu ile şifre sıfırlama linki oluşturur.
 * Partner email'siz kaydolduğu için normal "şifremi unuttum" akışı çalışmaz.
 * Admin linki kopyalayıp partner'e WhatsApp/telefonla iletir.
 */
export async function adminInitiatePartnerPasswordResetAction(
  phone: string,
): Promise<
  | { ok: true; resetUrl: string; userName: string }
  | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const normalized = normalizeTrGsm10(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone" };
  }

  const user = await prisma.user.findUnique({
    where: { phone: normalized },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return { ok: false, error: "user_not_found" };
  }

  const row = await generatePasswordResetTokenByPhone(normalized);

  /*
    SIFIRLAMA TOKEN'I DENETIM KAYDINA YAZILIYORDU (2026-08-31'de bulundu).

    `metadata: { tokenId: row.token }` -- alan adi `tokenId` oldugu icin bir
    tanimlayici gibi gorunuyordu, ama `row.token` sifirlama BAGININDAKI SIRRIN
    TA KENDISI: onu bilen, o hesabin parolasini degistirir.

    Nereye gidiyordu: `AuditLog.metadata` sutununa, kalici olarak. Ve
    `/admin/audit-log` sayfasi metadata'yi `JSON.stringify` ile EKRANA BASIYOR
    -- yani her yonetici, baslatilmis her sifirlamanin calisir durumdaki
    bagini okuyabiliyordu. Veritabani yedekleri ve log tasiyicilar da ayni
    degeri tasiyor.

    `rules/observability`: sir, token, PII log'a yazilmaz. Yerine geri donusu
    olmayan bir parmak izi: "hangi yonetici, kime, ne zaman" sorusunu
    yanitlamaya yetiyor, parolayi degistirmeye yetmiyor.
  */
  writeAuditLog({
    actorUserId: auth.actor.id,
    actorRole: auth.actor.role,
    action: "partner.password_reset_initiated",
    entityType: "User",
    entityId: user.id,
    metadata: {
      phone: normalized,
      tokenFingerprint: tokenFingerprint(row.token),
      expiresAt: row.expires.toISOString(),
    },
    ip: await clientIp(),
  });

  /*
    Taban adres ortak yardimciyla (`getSiteBaseUrl`) aliniyor. Onceden bu dosya
    kendi yedegini yaziyordu ve YALNIZCA `NEXT_PUBLIC_APP_URL`e bakiyordu;
    projenin geri kalani once `NEXT_PUBLIC_BASE_URL`i okuyor. Yani yalnizca
    ikincisi tanimliysa yonetici, `localhost:3000` isaret eden bir bag alip
    esnafa gonderiyordu -- ve bunun yanlis oldugunu ancak esnaf tiklayinca
    ogreniyordu.
  */
  const resetUrl = `${getSiteBaseUrl()}/tr/auth/new-password?token=${row.token}`;
  return { ok: true, resetUrl, userName: user.name || normalized };
}

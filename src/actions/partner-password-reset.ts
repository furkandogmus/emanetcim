"use server";

import { getClientIpOrNull } from "@/lib/client-ip";

import prisma from "@/lib/db";
import { normalizeTrGsm10 } from "@/lib/netgsm";
import { writeAuditLog } from "@/lib/audit-log";
import { requireAdmin } from "@/lib/action-auth";
import { createPartnerResetLink } from "@/lib/partner-reset-link";

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

  const link = await createPartnerResetLink(normalized);

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
      tokenFingerprint: link.tokenFingerprint,
      expiresAt: link.expiresAt.toISOString(),
    },
    ip: await getClientIpOrNull(),
  });

  return { ok: true, resetUrl: link.resetUrl, userName: user.name || normalized };
}

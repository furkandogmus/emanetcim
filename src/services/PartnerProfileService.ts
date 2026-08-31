import prisma from "@/lib/db";
import { normalizeTrGsm10 } from "@/lib/netgsm";

/**
 * Esnaf profil yazmaları — iki taşıyıcının ORTAK gövdesi.
 *
 * NEDEN VAR (2026-09-01'de ölçüldü): telefon güncelleme web action'ında ve
 * mobil uçta AYRI AYRI yazılmıştı ve mobil kopya kuralın hiçbirini
 * uygulamıyordu:
 *
 *   | | web (`updatePartnerPhoneAction`) | mobil (`partner/phone`) |
 *   | normalizasyon | `normalizeTrGsm10` → `5xxxxxxxxx` | YOK, ham yazılıyor |
 *   | geçersiz numara | hata döner | KABUL EDİLİR |
 *   | çakışma (P2002) | "bu numara kayıtlı" | jenerik 500 |
 *   | boşaltma | `null` yazar | mümkün değil |
 *
 * EN AĞIR SONUCU GİRİŞ. `User.phone` alanı `@unique` ve `auth.config.ts`
 * telefonla girişte iki biçim deniyor: yazılanın aynısı, ve 10 haneli normal
 * biçim. Mobilden `"0532 123 45 67"` yazılmışsa esnaf `05321234567` yazarak
 * giriş yapmaya çalıştığında İKİSİ DE tutmaz — kendi numarasıyla hesabına
 * giremez. Kayıt akışı da (`register.ts`) `normalizeTrGsm10` kullanıyor, yani
 * kural aslında her yerde aynıydı; yalnızca mobil uç dışarıda kalmıştı.
 */

export type UpdatePhoneResult =
  | { ok: true; phone: string | null }
  | { ok: false; reason: "invalid_tr_phone" | "already_registered" };

class PartnerProfileService {
  /**
   * Esnafın iletişim numarasını günceller.
   *
   * BOŞ DEĞER SİLMEDİR, hata değil: numarasını kaldırmak isteyen esnafın önünde
   * bir yol olmalı. Mobil uç `if (!phone)` ile 400 dönüyordu, yani numara bir kez
   * girildikten sonra uygulamadan silinemiyordu.
   */
  async updatePhone(userId: string, raw: string | null | undefined): Promise<UpdatePhoneResult> {
    const trimmed = (raw ?? "").trim();
    const normalized = trimmed ? normalizeTrGsm10(trimmed) : null;
    if (trimmed && !normalized) {
      return { ok: false, reason: "invalid_tr_phone" };
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { phone: normalized },
      });
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e
          ? (e as { code?: string }).code
          : undefined;
      // P2002: `User.phone` @unique. Baska bir hesap bu numarayi almis.
      if (code === "P2002") return { ok: false, reason: "already_registered" };
      throw e;
    }

    return { ok: true, phone: normalized };
  }
}

export const partnerProfileService = new PartnerProfileService();

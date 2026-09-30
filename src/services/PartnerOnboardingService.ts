import prisma from "@/lib/db";
import { Role } from "@prisma/client";
import { normalizeTrGsm10 } from "@/lib/netgsm";

/**
 * Admin'in esnaf ADINA hesap + dükkan açması.
 *
 * NEDEN VAR (2026-09-30): esnaflar kayıt formunu kendileri doldurmuyor; telefonda
 * anlaşılan esnaf için hesap şimdiye kadar prod veritabanına elle SQL yazılarak
 * açılıyordu (ilk örnek: Alanya, Merlin Home Tekstil, 2026-09-29). Elle SQL,
 * telefon normalizasyonunu, zorunlu koordinatı ve denetim izini atlıyordu.
 *
 * Kayıt formundan (`registerPartnerApplicationAction`) FARKLARI bilinçli:
 *   - **Şifre yok.** `passwordHash = null`; esnaf şifresini admin'in ilettiği
 *     bağla kendisi belirler (`createPartnerResetLink`). Admin şifre bilmez.
 *   - **Sözleşme onayı yazılmaz.** `LegalAcceptance` esnafın KENDİ onayıdır
 *     (IP'siyle birlikte); admin onu esnaf adına işaretleyemez.
 *   - **Konum admin'den gelir**, "konumumu bul"dan değil: admin dükkanda değil.
 *
 * Ortak olan: dükkan `isActive = false` açılır ve mevcut onay ekranından
 * (`approveShopAction`) geçmeden aramada görünmez.
 */

export type CreatePartnerInput = {
  ownerName: string;
  phone: string;
  email?: string | null;
  shopName: string;
  shopAddress: string;
  city?: string | null;
  district?: string | null;
  latitude: number;
  longitude: number;
};

export type CreatePartnerResult =
  | { ok: true; userId: string; shopId: string; phone: string }
  | {
      ok: false;
      reason: "invalid_tr_phone" | "phone_already_registered" | "email_already_registered";
    };

class PartnerOnboardingService {
  async createPartnerWithShop(input: CreatePartnerInput): Promise<CreatePartnerResult> {
    const phone = normalizeTrGsm10(input.phone);
    if (!phone) return { ok: false, reason: "invalid_tr_phone" };

    const email = input.email?.trim().toLowerCase() || null;

    /*
      Ön kontrol yalnızca DOĞRU MESAJ için: iki unique alan var ve P2002 hangisinin
      çakıştığını güvenilir biçimde söylemiyor. Yarışta (iki admin aynı anda)
      transaction yine P2002 ile düşer; aşağıda yakalanıyor.
    */
    const [phoneOwner, emailOwner] = await Promise.all([
      prisma.user.findUnique({ where: { phone }, select: { id: true } }),
      email ? prisma.user.findUnique({ where: { email }, select: { id: true } }) : null,
    ]);
    if (phoneOwner) return { ok: false, reason: "phone_already_registered" };
    if (emailOwner) return { ok: false, reason: "email_already_registered" };

    try {
      const { userId, shopId } = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            role: Role.PARTNER,
            name: input.ownerName.trim(),
            phone,
            email,
            passwordHash: null,
          },
          select: { id: true },
        });
        const shop = await tx.shop.create({
          data: {
            ownerId: user.id,
            name: input.shopName.trim(),
            address: input.shopAddress.trim(),
            city: input.city?.trim() || null,
            district: input.district?.trim() || null,
            latitude: input.latitude,
            longitude: input.longitude,
            isActive: false,
          },
          select: { id: true },
        });
        return { userId: user.id, shopId: shop.id };
      });
      return { ok: true, userId, shopId, phone };
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e
          ? (e as { code?: string }).code
          : undefined;
      if (code === "P2002") return { ok: false, reason: "phone_already_registered" };
      throw e;
    }
  }
}

export const partnerOnboardingService = new PartnerOnboardingService();

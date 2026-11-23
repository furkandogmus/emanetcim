import prisma from "@/lib/db";
import { Prisma, Role } from "@prisma/client";
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

/** Denetim kaydında işlemi başlatan yönetici (yoksa kayıt aktörsüz yazılır). */
export type OnboardingActor = { id: string; role: string } | null;

/**
 * Doğrulanmamış MİSAFİR hesabın tuttuğu telefonu esnaf için serbest bırakır.
 *
 * NEDEN (bulgu 18): profil ucu (`PUT /auth/me`) telefonun sahibini doğrulamıyor (SMS yok).
 * Bir misafir esnafın numarasını profiline yazınca adminin esnaf açması
 * `phone_already_registered` ile düşüyordu. Telefon tekil kalır (telefonla girişte iki hesap
 * aynı numarayı taşırsa gerçek sahibi giremiyordu); numara PARTNER/ADMIN hesaptaysa
 * dokunulmaz. Aynı transaction'da misafirin telefonu boşaltılır ve denetim izi yazılır.
 */
async function releaseGuestPhone(
  tx: Prisma.TransactionClient,
  holderId: string,
  phone: string,
  actor: OnboardingActor,
): Promise<void> {
  const cleared = await tx.user.updateMany({
    where: { id: holderId, role: Role.GUEST, phone },
    data: { phone: null },
  });
  // Yarışta numara el değiştirdiyse tekil kısıt zaten düşürür; burada açıkça reddet.
  if (cleared.count === 0) throw new PhoneHeldError();
  await tx.auditLog.create({
    data: {
      actorUserId: actor?.id ?? null,
      actorRole: actor?.role ?? "SYSTEM",
      action: "partner.guest_phone_released",
      entityType: "User",
      entityId: holderId,
      metadata: { phone },
    },
  });
}

class PhoneHeldError extends Error {
  constructor() {
    super("phone_held");
  }
}

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
  actor?: OnboardingActor;
};

export type CreatePartnerResult =
  | { ok: true; userId: string; shopId: string; phone: string }
  | {
      ok: false;
      reason: "invalid_tr_phone" | "phone_already_registered" | "email_already_registered";
    };

/**
 * Hesap + dukkan yazildiktan sonra AYNI transaction'da calisir. On kaydi esnafa
 * cevirme (`PartnerLeadService.convertToPartner`) kaydi burada isaretler: biri
 * duserse ikisi de geri alinir. Firlatilan hata cagirana aynen ulasir.
 */
export type OnboardingTxHook = (
  tx: Prisma.TransactionClient,
  created: { userId: string; shopId: string },
) => Promise<void>;

class PartnerOnboardingService {
  async createPartnerWithShop(
    input: CreatePartnerInput,
    opts: { inTx?: OnboardingTxHook } = {},
  ): Promise<CreatePartnerResult> {
    const phone = normalizeTrGsm10(input.phone);
    if (!phone) return { ok: false, reason: "invalid_tr_phone" };

    const email = input.email?.trim().toLowerCase() || null;

    /*
      Ön kontrol yalnızca DOĞRU MESAJ için: iki unique alan var ve P2002 hangisinin
      çakıştığını güvenilir biçimde söylemiyor. Yarışta (iki admin aynı anda)
      transaction yine P2002 ile düşer; aşağıda yakalanıyor.
    */
    const [phoneOwner, emailOwner] = await Promise.all([
      prisma.user.findUnique({ where: { phone }, select: { id: true, role: true } }),
      email ? prisma.user.findUnique({ where: { email }, select: { id: true } }) : null,
    ]);
    // Misafir numarayı tutuyorsa transaction içinde devralınır; esnaf/yönetici ise reddedilir.
    if (phoneOwner && phoneOwner.role !== Role.GUEST) return { ok: false, reason: "phone_already_registered" };
    if (emailOwner) return { ok: false, reason: "email_already_registered" };

    try {
      const { userId, shopId } = await prisma.$transaction(async (tx) => {
        if (phoneOwner) await releaseGuestPhone(tx, phoneOwner.id, phone, input.actor ?? null);
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
        await opts.inTx?.(tx, { userId: user.id, shopId: shop.id });
        return { userId: user.id, shopId: shop.id };
      });
      return { ok: true, userId, shopId, phone };
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e
          ? (e as { code?: string }).code
          : undefined;
      if (code === "P2002" || e instanceof PhoneHeldError) return { ok: false, reason: "phone_already_registered" };
      throw e;
    }
  }

  /**
   * Misafir hesabını esnafa çevirir: rol + telefon + onay bekleyen dükkan, tek
   * transaction'da. Esnaf aynı e-posta/şifreyle girmeye devam eder; doğrulama
   * istenmez. Rol JWT'nin içinde taşındığı için `tokenVersion` artar, kullanıcı
   * bir sonraki girişte esnaf olarak açılır.
   */
  async convertGuestToPartner(
    input: ConvertGuestInput,
    opts: { inTx?: OnboardingTxHook } = {},
  ): Promise<ConvertGuestResult> {
    const phone = normalizeTrGsm10(input.phone);
    if (!phone) return { ok: false, reason: "invalid_tr_phone" };

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, role: true, passwordHash: true },
    });
    if (!user) return { ok: false, reason: "not_found" };
    if (user.role !== Role.GUEST) return { ok: false, reason: "not_guest" };

    const phoneOwner = await prisma.user.findUnique({ where: { phone }, select: { id: true, role: true } });
    if (phoneOwner && phoneOwner.id !== user.id && phoneOwner.role !== Role.GUEST) {
      return { ok: false, reason: "phone_already_registered" };
    }
    const heldByOtherGuest = phoneOwner && phoneOwner.id !== user.id ? phoneOwner : null;

    try {
      const shopId = await prisma.$transaction(async (tx) => {
        if (heldByOtherGuest) await releaseGuestPhone(tx, heldByOtherGuest.id, phone, input.actor ?? null);
        // Rol koşulu yarışa karşı: iki admin aynı anda çevirirse ikincisi düşer.
        const updated = await tx.user.updateMany({
          where: { id: user.id, role: Role.GUEST },
          data: {
            role: Role.PARTNER,
            phone,
            tokenVersion: { increment: 1 },
            ...(input.name?.trim() ? { name: input.name.trim() } : {}),
          },
        });
        if (updated.count === 0) throw new Error("not_guest");
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
        await opts.inTx?.(tx, { userId: user.id, shopId: shop.id });
        return shop.id;
      });
      return { ok: true, shopId, phone, hasPassword: !!user.passwordHash };
    } catch (e: unknown) {
      if (e instanceof PhoneHeldError) return { ok: false, reason: "phone_already_registered" };
      if (e instanceof Error && e.message === "not_guest") return { ok: false, reason: "not_guest" };
      const code =
        e && typeof e === "object" && "code" in e
          ? (e as { code?: string }).code
          : undefined;
      if (code === "P2002") return { ok: false, reason: "phone_already_registered" };
      throw e;
    }
  }
}

export type ConvertGuestInput = {
  userId: string;
  /** Verilirse hesabin adi da guncellenir (on kayittan cevirmede admin'in duzelttigi ad). */
  name?: string;
  phone: string;
  shopName: string;
  shopAddress: string;
  city?: string | null;
  district?: string | null;
  latitude: number;
  longitude: number;
  actor?: OnboardingActor;
};

export type ConvertGuestResult =
  | { ok: true; shopId: string; phone: string; hasPassword: boolean }
  | {
      ok: false;
      reason: "invalid_tr_phone" | "phone_already_registered" | "not_found" | "not_guest";
    };

export const partnerOnboardingService = new PartnerOnboardingService();

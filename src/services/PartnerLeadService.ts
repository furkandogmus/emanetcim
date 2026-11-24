import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit-log";
import { parseCoordinates } from "@/lib/coordinates";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { normalizeTrGsm10 } from "@/lib/netgsm";
import { createPartnerResetLink } from "@/lib/partner-reset-link";
import { notificationService } from "@/services/NotificationService";
import { partnerOnboardingService, type OnboardingTxHook } from "@/services/PartnerOnboardingService";
import { shopService } from "@/services/ShopService";

/**
 * Turkiye telefonu: 10 hane, 2-5 ile baslar (sabit hat 2xx/3xx/4xx, GSM 5xx).
 * Esnaf cogu zaman dukkanin sabit hattini yazar; yalnizca GSM kabul etmek
 * formu gecerli bir numarayla terk ettirirdi.
 */
export function normalizeTrPhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return /^[2-5]\d{9}$/.test(d) ? d : null;
}

export type PartnerLeadInput = {
  fullName: string;
  phone: string;
  shopName?: string | null;
  address: string;
  locale: string;
  source: "web" | "mobile";
};

export type PartnerLeadResult =
  | { ok: true; alreadyRegistered: boolean }
  | { ok: false; code: "invalid_phone" };

/** Ayni numaradan bu sure icinde gelen ikinci kayit yeni satir acmaz. */
const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export class PartnerLeadService {
  async create(input: PartnerLeadInput): Promise<PartnerLeadResult> {
    const phone = normalizeTrPhone(input.phone);
    if (!phone) return { ok: false, code: "invalid_phone" };

    /*
      Esnaf "gitti mi?" diye formu iki kez gonderebilir. Ikinci kayit hem admin
      listesini kirletir hem de ayni kisiye iki kez arama yapilmasina yol acar.
    */
    const recent = await prisma.partnerLead.findFirst({
      where: { phone, createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } },
      select: { id: true },
    });
    if (recent) return { ok: true, alreadyRegistered: true };

    const lead = await prisma.partnerLead.create({
      data: {
        fullName: input.fullName.trim(),
        phone,
        shopName: input.shopName?.trim() || null,
        address: input.address.trim(),
        locale: input.locale,
        source: input.source,
      },
    });

    void notificationService
      .notifyAdminsForPartnerLead({
        fullName: lead.fullName,
        phone: lead.phone,
        shopName: lead.shopName,
        address: lead.address,
      })
      .catch((err) => logger.error({ err, leadId: lead.id }, "partner_lead_notify_failed"));

    return { ok: true, alreadyRegistered: false };
  }

  async list() {
    return prisma.partnerLead.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 500,
    });
  }

  /**
   * "Iletisime gecildi" / geri al; web action'i ve mobil admin ucu bunu cagirir.
   * `false`: kayit yok ya da cevrilmis (degismedi).
   */
  async setContacted(
    id: string,
    contacted: boolean,
    actor?: { userId: string | null; ip: string | null },
  ): Promise<boolean> {
    // Cevrilmis kayit "aranacak"a geri dusmesin: CONVERTED durumu kalicidir.
    const { count } = await prisma.partnerLead.updateMany({
      where: { id, convertedAt: null },
      data: contacted
        ? { status: "CONTACTED", contactedAt: new Date() }
        : { status: "NEW", contactedAt: null },
    });
    if (count > 0 && actor) {
      writeAuditLog({
        actorUserId: actor.userId,
        actorRole: "ADMIN",
        action: contacted ? "partner_lead.contacted" : "partner_lead.contact_undone",
        entityType: "PartnerLead",
        entityId: id,
        ip: actor.ip,
      });
    }
    return count > 0;
  }

  /**
   * On kaydi esnaf hesabi + dukkana TEK ADIMDA cevirir.
   *
   * NEDEN: admin ayni ad/telefon/adresi esnaf ekleme formuna yeniden yaziyordu.
   * Kurallar `PartnerOnboardingService`ten gelir (telefon normalizasyonu,
   * misafir telefonunu devralma, tekillik hatalari); burada yalnizca on kayit
   * eklenir:
   *   - Konum admin'den gelir, adresten turetilmez (`parseCoordinates` notu:
   *     adres geocode'u bir dukkani ~800 m yanlis yere koymustu).
   *   - E-posta bir MISAFIR hesabina aitse o hesap esnafa cevrilir (girisi
   *     korunur); esnaf/yonetici hesabina aitse acik hata.
   *   - Idempotent: kayit transaction icinde kosullu isaretlenir; ikinci ya da
   *     es zamanli cagri yeni hesap acmaz, ilk sonucu doner.
   *   - Dukkan onaysiz acilir (createPartnerWithShop varsayilani). `activate`
   *     ile normal onay yolundan (`approveApplication`: bildirim, denetim, slot)
   *     gecirilir; onay duserse hesap yine acik kalir ve sonuc bunu soyler.
   */
  async convertToPartner(input: LeadConversionInput): Promise<LeadConversionResult> {
    const lead = await prisma.partnerLead.findUnique({ where: { id: input.leadId } });
    if (!lead) return { ok: false, reason: "not_found" };
    if (lead.convertedAt) return existingConversion(lead);

    const draft = leadConversionDraft(lead);
    const ownerName = (input.ownerName ?? draft.ownerName).trim();
    const shopName = (input.shopName ?? draft.shopName).trim();
    const shopAddress = (input.shopAddress ?? draft.shopAddress).trim();
    const email = input.email?.trim().toLowerCase() || null;
    if (ownerName.length < 2 || ownerName.length > 120) return { ok: false, reason: "invalid_data" };
    if (shopName.length < 2 || shopName.length > 200) return { ok: false, reason: "invalid_data" };
    if (shopAddress.length < 5 || shopAddress.length > 500) return { ok: false, reason: "invalid_data" };
    if (email && (!EMAIL_RE.test(email) || isDisposableEmail(email))) return { ok: false, reason: "invalid_email" };
    const coords = parseCoordinates(input.location);
    if (!coords) return { ok: false, reason: "location_required" };
    const phone = normalizeTrGsm10(input.phone ?? draft.phone);
    if (!phone) return { ok: false, reason: "invalid_tr_phone" };

    const shop = {
      shopName,
      shopAddress,
      city: input.city?.trim() || null,
      district: input.district?.trim() || null,
      ...coords,
      actor: { id: input.actor.userId, role: "ADMIN" },
    };

    const markConverted: OnboardingTxHook = async (tx, created) => {
      const now = new Date();
      const marked = await tx.partnerLead.updateMany({
        where: { id: lead.id, convertedAt: null },
        data: {
          status: "CONVERTED",
          convertedAt: now,
          convertedById: input.actor.userId,
          convertedUserId: created.userId,
          convertedShopId: created.shopId,
        },
      });
      if (marked.count === 0) throw new LeadAlreadyConvertedError();
      await tx.auditLog.create({
        data: {
          actorUserId: input.actor.userId,
          actorRole: "ADMIN",
          action: "partner.lead_converted",
          entityType: "PartnerLead",
          entityId: lead.id,
          ip: input.actor.ip,
          metadata: { userId: created.userId, shopId: created.shopId, phone, activate: !!input.activate },
        },
      });
    };

    const emailOwner = email
      ? await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
      : null;

    let created: { userId: string; shopId: string; needsResetLink: boolean };
    try {
      if (emailOwner && emailOwner.role === "GUEST") {
        const r = await partnerOnboardingService.convertGuestToPartner(
          { userId: emailOwner.id, name: ownerName, phone, ...shop },
          { inTx: markConverted },
        );
        if (!r.ok) return this.failure(lead.id, r.reason === "not_guest" ? "email_already_registered" : r.reason);
        created = { userId: emailOwner.id, shopId: r.shopId, needsResetLink: !r.hasPassword };
      } else {
        const r = await partnerOnboardingService.createPartnerWithShop(
          { ownerName, phone, email, ...shop },
          { inTx: markConverted },
        );
        if (!r.ok) return this.failure(lead.id, r.reason);
        created = { userId: r.userId, shopId: r.shopId, needsResetLink: true };
      }
    } catch (e) {
      if (e instanceof LeadAlreadyConvertedError) return this.failure(lead.id, "phone_already_registered");
      throw e;
    }

    const resetUrl = created.needsResetLink ? (await createPartnerResetLink(phone)).resetUrl : null;

    let activated = false;
    let activationError: LeadActivationError | undefined;
    if (input.activate) {
      // Hesap ve dukkan artik kayitli: onay hatasi cevirmeyi geri almaz, sonucta doner.
      try {
        const approval = await shopService.approveApplication(created.shopId, {
          userId: input.actor.userId,
          ip: input.actor.ip,
        });
        activated = approval.ok;
        if (!approval.ok) activationError = approval.reason;
      } catch (err) {
        logger.error({ err, leadId: lead.id, shopId: created.shopId }, "lead_convert_activation_threw");
        activationError = "failed";
      }
      if (activationError) {
        logger.warn({ leadId: lead.id, shopId: created.shopId, reason: activationError }, "lead_convert_activation_failed");
      }
    }

    return {
      ok: true,
      alreadyConverted: false,
      userId: created.userId,
      shopId: created.shopId,
      phone,
      resetUrl,
      activated,
      ...(activationError ? { activationError } : {}),
    };
  }

  /** Yarista (iki admin ayni anda) kaybeden tarafa ilk cevirmenin sonucu doner. */
  private async failure(leadId: string, reason: LeadConversionFailure): Promise<LeadConversionResult> {
    const now = await prisma.partnerLead.findUnique({ where: { id: leadId } });
    if (now?.convertedAt) return existingConversion(now);
    return { ok: false, reason };
  }
}

class LeadAlreadyConvertedError extends Error {
  constructor() {
    super("lead_already_converted");
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LeadRow = {
  fullName: string;
  phone: string;
  shopName: string | null;
  address: string;
  convertedUserId?: string | null;
  convertedShopId?: string | null;
};

/**
 * Ilk cevirmenin sonucu. Yeniden deneyen admin bagi kaybetmis olabilir (ilk
 * yanit ulasmadi, sekme kapandi): esnaf hala sifre belirlemediyse yeni bag uretilir.
 */
async function existingConversion(lead: LeadRow): Promise<LeadConversionResult> {
  const user = lead.convertedUserId
    ? await prisma.user.findUnique({
        where: { id: lead.convertedUserId },
        select: { phone: true, passwordHash: true },
      })
    : null;
  const resetUrl =
    user?.phone && !user.passwordHash ? (await createPartnerResetLink(user.phone)).resetUrl : null;
  return {
    ok: true,
    alreadyConverted: true,
    userId: lead.convertedUserId ?? null,
    shopId: lead.convertedShopId ?? null,
    phone: user?.phone ?? lead.phone,
    resetUrl,
    activated: false,
  };
}

/** Cevirme formunun on dolgusu: on kayittaki alanlar, gerisi bos. */
export function leadConversionDraft(lead: LeadRow): LeadConversionDraft {
  return {
    ownerName: lead.fullName,
    // Sabit hat on kayitta gecerli, esnaf hesabinda degil: admin GSM yazar.
    phone: normalizeTrGsm10(lead.phone) ? `0${lead.phone}` : "",
    email: "",
    shopName: lead.shopName ?? "",
    shopAddress: lead.address,
    city: "",
    district: "",
    location: "",
  };
}

export type LeadConversionDraft = {
  ownerName: string;
  phone: string;
  email: string;
  shopName: string;
  shopAddress: string;
  city: string;
  district: string;
  location: string;
};

export type LeadConversionInput = {
  leadId: string;
  ownerName?: string;
  phone?: string;
  email?: string | null;
  shopName?: string;
  shopAddress?: string;
  city?: string | null;
  district?: string | null;
  /** Google Maps linki ya da `enlem, boylam` (`parseCoordinates`). Zorunlu. */
  location: string;
  activate?: boolean;
  actor: { userId: string; ip: string | null };
};

export type LeadConversionFailure =
  | "not_found"
  | "invalid_data"
  | "invalid_email"
  | "location_required"
  | "invalid_tr_phone"
  | "phone_already_registered"
  | "email_already_registered";

export type LeadActivationError = "missing_coordinates" | "not_found" | "failed";

export type LeadConversionResult =
  | {
      ok: true;
      alreadyConverted: boolean;
      userId: string | null;
      shopId: string | null;
      phone: string;
      /** Sifresiz acilan hesap icin esnafa iletilecek sifre belirleme bagi. */
      resetUrl: string | null;
      activated: boolean;
      activationError?: LeadActivationError;
    }
  | { ok: false; reason: LeadConversionFailure };

export const partnerLeadService = new PartnerLeadService();

import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { notificationService } from "@/services/NotificationService";

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

  async setContacted(id: string, contacted: boolean) {
    await prisma.partnerLead.update({
      where: { id },
      data: contacted
        ? { status: "CONTACTED", contactedAt: new Date() }
        : { status: "NEW", contactedAt: null },
    });
  }
}

export const partnerLeadService = new PartnerLeadService();

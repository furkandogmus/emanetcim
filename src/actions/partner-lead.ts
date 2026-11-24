"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { getClientIp, getClientIpOrNull } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/action-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { partnerLeadService } from "@/services/PartnerLeadService";
import logger from "@/lib/logger";

/**
 * Esnaf on kaydi. GIRIS GEREKTIRMEZ: amac, hesap acma zahmetine girmeden
 * "beni arayin" diyebilmesi. Spam'e karsi hiz siniri + gizli bal kupu alani.
 */

const schema = z.object({
  fullName: z.string().trim().min(3).max(100),
  phone: z.string().trim().min(7).max(20),
  shopName: z.string().trim().max(120).optional(),
  address: z.string().trim().min(5).max(400),
});

export type PartnerLeadFormState =
  | { status: "idle" }
  | { status: "success"; name: string; alreadyRegistered: boolean }
  | { status: "error"; error: "Errors.invalidPhone" | "Errors.invalidInput" | "Errors.tooManyRequests" | "Errors.generic" };

export async function submitPartnerLeadAction(
  _prev: PartnerLeadFormState,
  formData: FormData,
): Promise<PartnerLeadFormState> {
  // Bal kupu: gercek kullanici bu gizli alani gormez; dolduran bottur. Basari gibi gorunur.
  if (String(formData.get("website") ?? "").length > 0) {
    return { status: "success", name: "", alreadyRegistered: false };
  }

  const ip = await getClientIp();
  if (!(await rateLimit(`partner-lead:${ip}`, 5, 10 * 60_000))) {
    return { status: "error", error: "Errors.tooManyRequests" };
  }

  const parsed = schema.safeParse({
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    shopName: formData.get("shopName") || undefined,
    address: formData.get("address") ?? "",
  });
  if (!parsed.success) {
    const phoneBad = parsed.error.issues.some((i) => i.path[0] === "phone");
    return { status: "error", error: phoneBad ? "Errors.invalidPhone" : "Errors.invalidInput" };
  }

  try {
    const result = await partnerLeadService.create({
      ...parsed.data,
      locale: await getLocale(),
      source: "web",
    });
    if (!result.ok) return { status: "error", error: "Errors.invalidPhone" };
    return {
      status: "success",
      name: parsed.data.fullName.split(/\s+/)[0],
      alreadyRegistered: result.alreadyRegistered,
    };
  } catch (err) {
    logger.error({ err }, "partner_lead_action_failed");
    return { status: "error", error: "Errors.generic" };
  }
}

const contactedSchema = z.object({
  id: z.string().min(10).max(64),
  contacted: z.boolean(),
});

export async function setPartnerLeadContactedAction(input: unknown) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const parsed = contactedSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Errors.invalidInput" };

  try {
    await partnerLeadService.setContacted(parsed.data.id, parsed.data.contacted, {
      userId: auth.actor.id,
      ip: await getClientIpOrNull(),
    });
  } catch (err) {
    logger.error({ err }, "partner_lead_contacted_failed");
    return { success: false as const, error: "Errors.generic" };
  }
  revalidatePathAllLocales("/admin/partner-leads");
  return { success: true as const };
}

const convertSchema = z.object({
  leadId: z.string().min(10).max(64),
  ownerName: z.string().trim().max(120),
  phone: z.string().trim().max(20),
  email: z.string().trim().max(200).optional(),
  shopName: z.string().trim().max(200),
  shopAddress: z.string().trim().max(500),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  location: z.string().trim().max(2000),
  activate: z.boolean().optional(),
});

const CONVERT_ERRORS = {
  not_found: "Errors.notFound",
  invalid_data: "Errors.invalidData",
  invalid_email: "Errors.invalidEmail",
  location_required: "Errors.shopLocationRequired",
  invalid_tr_phone: "Errors.invalidTrPhone",
  phone_already_registered: "Errors.phoneAlreadyRegistered",
  email_already_registered: "Errors.emailAlreadyRegistered",
} as const;

export type ConvertPartnerLeadActionResult =
  | {
      ok: true;
      alreadyConverted: boolean;
      shopId: string | null;
      resetUrl: string | null;
      activated: boolean;
      activationFailed: boolean;
    }
  | { ok: false; error: string };

/** Admin: on kaydi esnaf hesabi + dukkana cevirir. Govde `PartnerLeadService.convertToPartner`. */
export async function convertPartnerLeadAction(raw: unknown): Promise<ConvertPartnerLeadActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = convertSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Errors.invalidData" };

  try {
    const result = await partnerLeadService.convertToPartner({
      ...parsed.data,
      actor: { userId: auth.actor.id, ip: await getClientIpOrNull() },
    });
    if (!result.ok) return { ok: false, error: CONVERT_ERRORS[result.reason] };
    revalidatePathAllLocales("/admin/partner-leads");
    revalidatePathAllLocales("/admin/partners");
    revalidatePathAllLocales("/admin/applications");
    return {
      ok: true,
      alreadyConverted: result.alreadyConverted,
      shopId: result.shopId,
      resetUrl: result.resetUrl,
      activated: result.activated,
      activationFailed: Boolean(result.activationError),
    };
  } catch (err) {
    logger.error({ err }, "partner_lead_convert_failed");
    return { ok: false, error: "Errors.generic" };
  }
}

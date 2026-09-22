"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { getClientIp } from "@/lib/client-ip";
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
    await partnerLeadService.setContacted(parsed.data.id, parsed.data.contacted);
  } catch (err) {
    logger.error({ err }, "partner_lead_contacted_failed");
    return { success: false as const, error: "Errors.generic" };
  }
  revalidatePathAllLocales("/admin/partner-leads");
  return { success: true as const };
}

import { z } from "zod";
import { writeAuditLog } from "@/lib/audit-log";
import { parseCoordinates } from "@/lib/coordinates";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { createPartnerResetLink } from "@/lib/partner-reset-link";
import { partnerOnboardingService } from "@/services/PartnerOnboardingService";

/**
 * Yoneticinin sifirdan esnaf + dukkan acmasi ve misafiri esnafa cevirmesi.
 * Web action'lari (`admin-partner-create.ts`, `admin-user-account.ts`) ve mobil
 * `admin/partners` ucu bu govdeyi cagirir: sema, koordinat, sifre bagi ve denetim
 * kaydi tek yerde. Hesap/dukkan yazimi `PartnerOnboardingService`te.
 */
export type PartnerCreateActor = { id: string; role: string };
type Ctx = { ip?: string | null };

const shopFields = {
  phone: z.string().trim().min(10).max(20),
  shopName: z.string().trim().min(2).max(200),
  shopAddress: z.string().trim().min(5).max(500),
  city: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  /** Google Maps linki ya da `enlem, boylam` (`parseCoordinates`). */
  location: z.string().trim().min(3).max(2000),
};

const createSchema = z.object({
  ownerName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().optional().or(z.literal("")),
  ...shopFields,
});

const convertSchema = z.object({ userId: z.string().uuid(), ...shopFields });

export type AdminPartnerCreateFailure =
  | "invalid_data"
  | "location_required"
  | "invalid_email"
  | "invalid_tr_phone"
  | "phone_already_registered"
  | "email_already_registered";

export type AdminGuestConvertFailure =
  | "invalid_data"
  | "location_required"
  | "invalid_tr_phone"
  | "phone_already_registered"
  | "not_found"
  | "not_guest";

export type AdminPartnerCreateResult =
  | { ok: true; userId: string; shopId: string; phone: string; resetUrl: string }
  | { ok: false; reason: AdminPartnerCreateFailure };

export type AdminGuestConvertResult =
  | { ok: true; userId: string; shopId: string; phone: string; resetUrl: string | null }
  | { ok: false; reason: AdminGuestConvertFailure };

export class AdminPartnerCreateService {
  async createPartner(actor: PartnerCreateActor, raw: unknown, ctx: Ctx = {}): Promise<AdminPartnerCreateResult> {
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, reason: "invalid_data" };
    const input = parsed.data;

    const coords = parseCoordinates(input.location);
    if (!coords) return { ok: false, reason: "location_required" };
    if (input.email && isDisposableEmail(input.email)) return { ok: false, reason: "invalid_email" };

    const result = await partnerOnboardingService.createPartnerWithShop({
      ownerName: input.ownerName,
      phone: input.phone,
      email: input.email || null,
      shopName: input.shopName,
      shopAddress: input.shopAddress,
      city: input.city,
      district: input.district,
      ...coords,
      actor: { id: actor.id, role: actor.role },
    });
    if (!result.ok) return { ok: false, reason: result.reason };

    const link = await createPartnerResetLink(result.phone);
    writeAuditLog({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "partner.created_by_admin",
      entityType: "Shop",
      entityId: result.shopId,
      metadata: {
        userId: result.userId,
        phone: result.phone,
        tokenFingerprint: link.tokenFingerprint,
        expiresAt: link.expiresAt.toISOString(),
      },
      ip: ctx.ip ?? null,
    });
    return { ok: true, userId: result.userId, shopId: result.shopId, phone: result.phone, resetUrl: link.resetUrl };
  }

  /** Hesabin sifresi yoksa (Google/Apple ile girmis) sifre belirleme bagi da doner. */
  async convertGuest(actor: PartnerCreateActor, raw: unknown, ctx: Ctx = {}): Promise<AdminGuestConvertResult> {
    const parsed = convertSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, reason: "invalid_data" };
    const input = parsed.data;

    const coords = parseCoordinates(input.location);
    if (!coords) return { ok: false, reason: "location_required" };

    const result = await partnerOnboardingService.convertGuestToPartner({
      userId: input.userId,
      phone: input.phone,
      shopName: input.shopName,
      shopAddress: input.shopAddress,
      city: input.city,
      district: input.district,
      ...coords,
      actor: { id: actor.id, role: actor.role },
    });
    if (!result.ok) return { ok: false, reason: result.reason };

    const link = result.hasPassword ? null : await createPartnerResetLink(result.phone);
    writeAuditLog({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "user.converted_to_partner",
      entityType: "User",
      entityId: input.userId,
      metadata: {
        shopId: result.shopId,
        phone: result.phone,
        ...(link ? { tokenFingerprint: link.tokenFingerprint, expiresAt: link.expiresAt.toISOString() } : {}),
      },
      ip: ctx.ip ?? null,
    });
    return {
      ok: true,
      userId: input.userId,
      shopId: result.shopId,
      phone: result.phone,
      resetUrl: link?.resetUrl ?? null,
    };
  }
}

export const adminPartnerCreateService = new AdminPartnerCreateService();

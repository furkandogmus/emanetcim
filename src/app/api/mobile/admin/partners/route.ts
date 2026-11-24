import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/internal-api-guard";
import logger from "@/lib/logger";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { toMobileAdminPartnerCreated } from "@/lib/mobile-dto";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { adminPartnerCreateService } from "@/services/AdminPartnerCreateService";

// Alan sinirlari serviste; burada yalniz tanimadik alan reddedilir.
const BodySchema = z
  .object({
    fromUserId: z.string().max(64).optional(),
    ownerName: z.string().max(200).optional(),
    phone: z.string().max(40),
    email: z.string().max(200).optional(),
    shopName: z.string().max(300),
    shopAddress: z.string().max(600),
    city: z.string().max(150).optional(),
    district: z.string().max(150).optional(),
    location: z.string().max(2000),
  })
  .strict();

const STATUS: Record<string, number> = {
  not_found: 404,
  phone_already_registered: 409,
  email_already_registered: 409,
  not_guest: 409,
};

/**
 * Mobil admin: sifirdan esnaf hesabi + dukkan acar; `fromUserId` verilirse o misafir
 * hesabini esnafa cevirir (yeni hesap acmaz). Govde `AdminPartnerCreateService` (web ile ayni).
 * 201 `{ userId, shopId, phone, resetUrl }`.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = forbidWhileImpersonating(auth.user) ?? requireRole(auth.user, ["ADMIN"]);
  if (forbid) return forbid;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const { fromUserId, ownerName, email, ...shop } = parsed.data;
  const ctx = { ip: clientIp(req) };

  const result = fromUserId
    ? await adminPartnerCreateService.convertGuest(auth.user, { userId: fromUserId, ...shop }, ctx)
    : await adminPartnerCreateService.createPartner(auth.user, { ownerName, email, ...shop }, ctx);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: STATUS[result.reason] ?? 400 });

  try {
    revalidatePathAllLocales("/admin/partners");
    revalidatePathAllLocales("/admin/applications");
    if (fromUserId) revalidatePathAllLocales("/admin/users");
  } catch (err) {
    logger.error({ shopId: result.shopId, err }, "revalidate_after_partner_create_failed");
  }
  return NextResponse.json(toMobileAdminPartnerCreated(result), { status: 201 });
}

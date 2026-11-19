import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIpFromRequest } from "@/lib/client-ip";
import { toMobileAdminShopDetail } from "@/lib/mobile-dto";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import logger from "@/lib/logger";
import { adminOpsService } from "@/services/AdminOpsService";
import { shopService } from "@/services/ShopService";

async function admin(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return { error: auth.error } as const;
  const forbid = requireRole(auth.user, ["ADMIN"]);
  if (forbid) return { error: forbid } as const;
  return { user: auth.user } as const;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await admin(req);
  if ("error" in a) return a.error;
  const { id } = await params;
  const detail = await adminOpsService.shopDetail(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(toMobileAdminShopDetail(detail));
}

/** Web duzenleme ekraniyla ayni alanlar; kural `ShopService.adminUpdateShop`ta. */
const PatchSchema = z
  .object({
    name: z.string().max(120).optional(),
    address: z.string().max(300).optional(),
    capacity: z.number().int().optional(),
    pricePerDay: z.number().optional(),
    isActive: z.boolean().optional(),
    isTest: z.boolean().optional(),
    isVerified: z.boolean().optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await admin(req);
  if ("error" in a) return a.error;
  const { id } = await params;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_data" }, { status: 400 });

  const result = await shopService.adminUpdateShop(id, parsed.data, {
    userId: a.user.id,
    ip: clientIpFromRequest(req),
  });
  if (!result.ok) {
    return result.error === "Errors.notFound"
      ? NextResponse.json({ error: "not_found" }, { status: 404 })
      : NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }
  try {
    revalidatePathAllLocales("/admin/partners");
    revalidatePathAllLocales("/search");
  } catch (err) {
    logger.error({ shopId: id, err }, "revalidate_after_shop_update_failed");
  }

  const detail = await adminOpsService.shopDetail(id);
  return NextResponse.json(detail ? toMobileAdminShopDetail(detail) : { ok: true });
}

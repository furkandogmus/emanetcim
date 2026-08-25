import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { sealService } from "@/services/SealService";
import { SEAL_CODE_TO_HTTP } from "@/lib/mobile-seal-response";

/** Mobil istemci adet gondermezse acilan varsayilan talep. */
const DEFAULT_REQUEST_COUNT = 10;
/** Mobil formda tek seferde istenebilecek ust sinir (servis sinirindan dar). */
const MOBILE_MAX_COUNT = 100;

/**
 * Esnaf: mobilden muhur talebi acar.
 *
 * Govde `SealService.createRequest`'te; web action'i da AYNI cagriyi yapar.
 * Bu uc 2026-08-25'e kadar kendi `prisma.sealRequest.create`'ini yaziyordu ve
 * `requestedBy` alanini bos birakiyordu — talebi kimin actigi kayitsiz kaliyordu.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  const shop = await prisma.shop.findFirst({
    where: { ownerId: auth.user.id, isActive: true },
    select: { id: true },
  });
  if (!shop) return NextResponse.json({ error: "no_shop" }, { status: 404 });

  const { count } = await req.json().catch(() => ({ count: undefined }));
  const requestCount = Math.min(
    Math.max(1, Number(count) || DEFAULT_REQUEST_COUNT),
    MOBILE_MAX_COUNT,
  );

  const result = await sealService.createRequest(shop.id, requestCount, {
    id: auth.user.id,
    role: "PARTNER",
  });

  if (!result.ok) {
    const { status, error } = SEAL_CODE_TO_HTTP[result.code];
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json({ success: true, id: result.requestId, count: requestCount });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { resolveRequestLocale } from "@/lib/request-locale";
import { toMobileWalkInResult } from "@/lib/mobile-dto";
import type { WalkInInput } from "@/lib/walk-in-input";
import { walkInBookingService, type WalkInErrorCode } from "@/services/WalkInBookingService";

const CODE_TO_HTTP: Record<WalkInErrorCode, { status: number; error: string }> = {
  INVALID_INPUT: { status: 400, error: "invalid_data" },
  IN_PROGRESS: { status: 409, error: "request_in_progress" },
  TERMS_REQUIRED: { status: 400, error: "terms_required" },
  INVALID_DATES: { status: 400, error: "invalid_dates" },
  PLATFORM_HOLIDAY: { status: 400, error: "platform_holiday" },
  TOO_MANY_BAGS: { status: 400, error: "too_many_bags" },
  NOT_FOUND: { status: 404, error: "shop_not_found" },
  // Baska dukkanin personeli dukkanin varligini ogrenmesin.
  FORBIDDEN: { status: 404, error: "shop_not_found" },
  SHOP_NOT_OPERATING: { status: 409, error: "shop_not_operating" },
  SHOP_PRELAUNCH: { status: 409, error: "shop_not_operating" },
  SHOP_CLOSED_ON_DATE: { status: 409, error: "shop_closed_at_time" },
  CAPACITY_EXCEEDED: { status: 409, error: "insufficient_capacity" },
  RATE_LIMITED: { status: 429, error: "too_many_requests" },
  LOGIN_REQUIRED: { status: 401, error: "unauthorized" },
};

/**
 * Kapidan gelen misafir (esnaf uygulamasi). Web `createWalkInBookingAction` ile ayni servis;
 * yetki `operate` (sahip, personel, yonetici). E-posta dili istegin dil basligi.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  // Govde serviste `walkInInputSchema` ile dogrulanir.
  const parsedBody = (await req.json().catch(() => null)) as WalkInInput | null;
  // Mobil checkout gibi `Idempotency-Key` basligi da kabul edilir; govdedeki alan onceliklidir.
  const headerKey = req.headers.get("idempotency-key")?.trim();
  const body =
    parsedBody && typeof parsedBody === "object" && headerKey && !parsedBody.idempotencyKey
      ? { ...parsedBody, idempotencyKey: headerKey }
      : parsedBody;
  const result = await walkInBookingService.create(
    { id: auth.user.id, role: auth.user.role, impersonatedBy: auth.user.impersonatedBy ?? null },
    body,
    { locale: resolveRequestLocale(req.headers.get("accept-language")) },
  );
  if (!result.ok) {
    const { status, error } = CODE_TO_HTTP[result.code] ?? { status: 400, error: "invalid_data" };
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json(toMobileWalkInResult(result), { status: 201 });
}

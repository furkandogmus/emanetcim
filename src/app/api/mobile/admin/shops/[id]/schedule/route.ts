import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest } from "@/lib/client-ip";
import logger from "@/lib/logger";
import { forbidWhileImpersonating, requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { closureInputSchema, weeklyHoursSchema } from "@/lib/shop-schedule-input";
import {
  addClosure,
  getScheduleView,
  removeClosure,
  saveWeeklyHours,
  type SaveScheduleResult,
} from "@/services/ShopScheduleService";
import { revalidateShopContent } from "../revalidate";

/*
  Yonetici, esnaf adina calisma saatleri ve izin gunleri. Esnafin
  `partner/shop/schedule` ucu ve web `shop-schedule` action'lari ile AYNI servis
  ve ayni sema: cakisan rezervasyon kurali (409 + liste) yonetici icin de
  gecerli. Esnaf ucu yalnizca PARTNER'a acik kalir; bu uc yalnizca ADMIN'e.
*/
async function gate(req: NextRequest, mutation: boolean) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return { error: auth.error } as const;
  const forbid = requireRole(auth.user, ["ADMIN"]) ?? (mutation ? forbidWhileImpersonating(auth.user) : null);
  if (forbid) return { error: forbid } as const;
  return { actor: { id: auth.user.id, role: auth.user.role, ip: clientIpFromRequest(req) } } as const;
}

function respond(res: SaveScheduleResult, shopId: string) {
  if (res.ok) {
    revalidateShopContent(shopId);
    return NextResponse.json({ ok: true });
  }
  if (res.code === "CONFLICT") {
    return NextResponse.json({ error: "schedule_conflict", conflicts: res.conflicts }, { status: 409 });
  }
  return NextResponse.json({ error: "invalid_input" }, { status: 400 });
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const g = await gate(req, false);
  if ("error" in g) return g.error;
  const { id } = await params;
  const view = await getScheduleView(id);
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(view);
}

/** Haftalik saat + 7/24. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const g = await gate(req, true);
  if ("error" in g) return g.error;
  const { id } = await params;
  try {
    const parsed = weeklyHoursSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return respond(await saveWeeklyHours(id, parsed.data.days, parsed.data.open247, g.actor), id);
  } catch (err) {
    logger.error({ err, shopId: id }, "mobile_admin_schedule_save_failed");
    return NextResponse.json({ error: "schedule_save_failed" }, { status: 400 });
  }
}

/** Izin araligi ekler. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await gate(req, true);
  if ("error" in g) return g.error;
  const { id } = await params;
  try {
    const parsed = closureInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return respond(await addClosure(id, parsed.data, undefined, g.actor), id);
  } catch (err) {
    logger.error({ err, shopId: id }, "mobile_admin_closure_add_failed");
    return NextResponse.json({ error: "schedule_save_failed" }, { status: 400 });
  }
}

/** `?closureId=` ile izin araligini kaldirir. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const g = await gate(req, true);
  if ("error" in g) return g.error;
  const { id } = await params;
  const closureId = req.nextUrl.searchParams.get("closureId");
  if (!closureId) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  await removeClosure(id, closureId, g.actor);
  revalidateShopContent(id);
  return NextResponse.json({ ok: true });
}

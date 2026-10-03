import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { shopService } from "@/services/ShopService";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import {
  addClosure,
  removeClosure,
  saveWeeklyHours,
  type SaveScheduleResult,
} from "@/services/ShopScheduleService";

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7];

const hoursSchema = z.object({
  open247: z.boolean(),
  days: z
    .array(
      z.object({
        weekday: z.number().int().min(1).max(7),
        isClosed: z.boolean(),
        openingTime: z.string().max(5),
        closingTime: z.string().max(5),
      }),
    )
    .length(7),
});

const closureSchema = z.object({
  startDate: z.string().max(10),
  endDate: z.string().max(10),
  reason: z.string().max(200).optional(),
});

async function partnerShop(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return { error: auth.error };
  const forbid = requireRole(auth.user, ["PARTNER"]);
  if (forbid) return { error: forbid };
  const shop = await shopService.getShopByOwner(auth.user.id);
  if (!shop) return { error: NextResponse.json({ error: "Shop not found" }, { status: 404 }) };
  return { shop };
}

function respond(res: SaveScheduleResult) {
  if (res.ok) return NextResponse.json({ ok: true });
  if (res.code === "CONFLICT") {
    return NextResponse.json({ error: "schedule_conflict", conflicts: res.conflicts }, { status: 409 });
  }
  return NextResponse.json({ error: "invalid_input" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const gate = await partnerShop(req);
  if ("error" in gate) return gate.error;
  const { shop } = gate;

  const [rows, closures] = await Promise.all([
    prisma.shopWeeklyHours.findMany({ where: { shopId: shop.id } }),
    prisma.shopClosure.findMany({
      where: { shopId: shop.id, endDate: { gte: new Date().toISOString().slice(0, 10) } },
      orderBy: { startDate: "asc" },
    }),
  ]);
  const byDay = new Map(rows.map((r) => [r.weekday, r]));
  return NextResponse.json({
    open247: shop.open247,
    days: ISO_DAYS.map((weekday) => {
      const r = byDay.get(weekday);
      return {
        weekday,
        isClosed: r?.isClosed ?? false,
        openingTime: r?.openingTime ?? shop.openingTime ?? "09:00",
        closingTime: r?.closingTime ?? shop.closingTime ?? "20:00",
      };
    }),
    closures: closures.map((c) => ({
      id: c.id,
      startDate: c.startDate,
      endDate: c.endDate,
      reason: c.reason,
    })),
  });
}

/** Haftalık saat + 7/24. */
export async function PUT(req: NextRequest) {
  const gate = await partnerShop(req);
  if ("error" in gate) return gate.error;
  try {
    const parsed = hoursSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return respond(await saveWeeklyHours(gate.shop.id, parsed.data.days, parsed.data.open247));
  } catch (err) {
    logger.error({ err }, "mobile_partner_schedule_save_failed");
    return NextResponse.json({ error: "schedule_save_failed" }, { status: 400 });
  }
}

/** İzin aralığı ekler. */
export async function POST(req: NextRequest) {
  const gate = await partnerShop(req);
  if ("error" in gate) return gate.error;
  try {
    const parsed = closureSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    return respond(await addClosure(gate.shop.id, parsed.data));
  } catch (err) {
    logger.error({ err }, "mobile_partner_closure_add_failed");
    return NextResponse.json({ error: "schedule_save_failed" }, { status: 400 });
  }
}

/** `?closureId=` ile izin aralığını kaldırır. */
export async function DELETE(req: NextRequest) {
  const gate = await partnerShop(req);
  if ("error" in gate) return gate.error;
  const closureId = req.nextUrl.searchParams.get("closureId");
  if (!closureId) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  await removeClosure(gate.shop.id, closureId);
  return NextResponse.json({ ok: true });
}

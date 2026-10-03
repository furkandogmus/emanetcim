"use server";

import { z } from "zod";
import prisma from "@/lib/db";
import { requireUser } from "@/lib/action-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import {
  addClosure,
  removeClosure,
  saveWeeklyHours,
} from "@/services/ShopScheduleService";

const weeklySchema = z.object({
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

function revalidate() {
  revalidatePathAllLocales("/partner");
  revalidatePathAllLocales("/partner/settings");
  revalidatePathAllLocales("/admin/partners");
}

export async function saveWeeklyHoursAction(shopId: string, input: unknown) {
  const auth = await requireUser();
  if (!auth.ok) return { success: false as const, error: auth.error };
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { ownerId: true } });
  if (!shop) return { success: false as const, error: "Errors.shopNotFound" };
  if (shop.ownerId !== auth.actor.id && auth.actor.role !== "ADMIN") {
    return { success: false as const, error: "Errors.unauthorized" };
  }
  const parsed = weeklySchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Errors.invalidData" };

  const res = await saveWeeklyHours(shopId, parsed.data.days, parsed.data.open247);
  if (!res.ok) {
    return res.code === "CONFLICT"
      ? { success: false as const, error: "Errors.scheduleConflict", conflicts: res.conflicts }
      : { success: false as const, error: "Errors.invalidData" };
  }
  revalidate();
  return { success: true as const };
}

export async function addClosureAction(shopId: string, input: unknown) {
  const auth = await requireUser();
  if (!auth.ok) return { success: false as const, error: auth.error };
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { ownerId: true } });
  if (!shop) return { success: false as const, error: "Errors.shopNotFound" };
  if (shop.ownerId !== auth.actor.id && auth.actor.role !== "ADMIN") {
    return { success: false as const, error: "Errors.unauthorized" };
  }
  const parsed = closureSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Errors.invalidData" };

  const res = await addClosure(shopId, parsed.data);
  if (!res.ok) {
    return res.code === "CONFLICT"
      ? { success: false as const, error: "Errors.scheduleConflict", conflicts: res.conflicts }
      : { success: false as const, error: "Errors.invalidData" };
  }
  revalidate();
  return { success: true as const };
}

export async function removeClosureAction(shopId: string, closureId: string) {
  const auth = await requireUser();
  if (!auth.ok) return { success: false as const, error: auth.error };
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { ownerId: true } });
  if (!shop) return { success: false as const, error: "Errors.shopNotFound" };
  if (shop.ownerId !== auth.actor.id && auth.actor.role !== "ADMIN") {
    return { success: false as const, error: "Errors.unauthorized" };
  }
  await removeClosure(shopId, closureId);
  revalidate();
  return { success: true as const };
}

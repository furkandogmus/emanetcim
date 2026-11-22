"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/action-auth";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { getClientIpOrNull } from "@/lib/client-ip";
import { closureInputSchema, weeklyHoursSchema } from "@/lib/shop-schedule-input";
import {
  addClosure,
  removeClosure,
  saveWeeklyHours,
} from "@/services/ShopScheduleService";

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
  const parsed = weeklyHoursSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Errors.invalidData" };

  // Yonetici esnaf adina duzenliyorsa servis denetim kaydi birakir.
  const actor = { id: auth.actor.id, role: auth.actor.role, ip: await getClientIpOrNull() };
  const res = await saveWeeklyHours(shopId, parsed.data.days, parsed.data.open247, actor);
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
  const parsed = closureInputSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Errors.invalidData" };

  const actor = { id: auth.actor.id, role: auth.actor.role, ip: await getClientIpOrNull() };
  const res = await addClosure(shopId, parsed.data, undefined, actor);
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
  await removeClosure(shopId, closureId, { id: auth.actor.id, role: auth.actor.role, ip: await getClientIpOrNull() });
  revalidate();
  return { success: true as const };
}

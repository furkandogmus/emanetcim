import prisma from "@/lib/db";
import type { ClosureRange, WeeklyDay } from "@/lib/shop-schedule";

export type ShopScheduleParts = { weekly: WeeklyDay[]; closures: ClosureRange[] };

/** Birden çok dükkanın haftalık saati + izinleri; dükkan sayısından bağımsız iki sorgu. */
export async function loadScheduleParts(
  shopIds: string[],
  fromDate?: string,
): Promise<Map<string, ShopScheduleParts>> {
  const out = new Map<string, ShopScheduleParts>();
  if (shopIds.length === 0) return out;

  const [weekly, closures] = await Promise.all([
    prisma.shopWeeklyHours.findMany({
      where: { shopId: { in: shopIds } },
      orderBy: { weekday: "asc" },
    }),
    prisma.shopClosure.findMany({
      where: { shopId: { in: shopIds }, ...(fromDate ? { endDate: { gte: fromDate } } : {}) },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const entry = (id: string) => {
    let e = out.get(id);
    if (!e) out.set(id, (e = { weekly: [], closures: [] }));
    return e;
  };
  for (const w of weekly) {
    entry(w.shopId).weekly.push({
      weekday: w.weekday,
      isClosed: w.isClosed,
      openingTime: w.openingTime,
      closingTime: w.closingTime,
    });
  }
  for (const c of closures) {
    entry(c.shopId).closures.push({ startDate: c.startDate, endDate: c.endDate });
  }
  return out;
}

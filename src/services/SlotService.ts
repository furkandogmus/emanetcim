import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const SLOT_MINUTES = 30;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES; // 2
const MS_PER_SLOT = SLOT_MINUTES * 60 * 1000;

export function slotDuration(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_SLOT));
}

export function slotStartTime(slotIndex: number, baseDate: Date): Date {
  return new Date(baseDate.getTime() + slotIndex * MS_PER_SLOT);
}

export function slotsBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / MS_PER_SLOT);
}

export function slotIdsBetween(
  shopId: string,
  baseDate: Date,
  count: number,
): Array<{ shopId: string; startTime: Date }> {
  const slots: Array<{ shopId: string; startTime: Date }> = [];
  const base = new Date(baseDate);
  for (let i = 0; i < count; i++) {
    const t = slotStartTime(i, base);
    const utc = new Date(t.getTime() + t.getTimezoneOffset() * 60000);
    slots.push({ shopId, startTime: utc });
  }
  return slots;
}

export function operatingHoursToSlots(
  openingTime: string | null,
  closingTime: string | null,
  open247: boolean,
): number {
  if (open247) return 48;
  const [oh, om] = (openingTime || "09:00").split(":").map(Number);
  const [ch, cm] = (closingTime || "20:00").split(":").map(Number);
  const openMins = oh * 60 + om;
  const closeMins = ch * 60 + cm;
  return Math.max(0, Math.ceil((closeMins - openMins) / SLOT_MINUTES));
}

async function shopTimeZone(shopId: string): Promise<string> {
  const shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shopId },
    select: { timezone: true },
  });
  return shop.timezone ?? "Europe/Istanbul";
}

export async function generateSlotsForShop(
  shopId: string,
  daysForward = 30,
) {
  const shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shopId },
    select: { id: true, open247: true, openingTime: true, closingTime: true, capacity: true, timezone: true },
  });

  const tz = shop.timezone;
  const slotsPerDay = operatingHoursToSlots(shop.openingTime, shop.closingTime, shop.open247);
  if (slotsPerDay === 0) return 0;

  let created = 0;
  const now = new Date();

  for (let dayOffset = 0; dayOffset < daysForward; dayOffset++) {
    const dayBase = new Date(now.getTime() + dayOffset * 86400000);
    const localStart = new Date(dayBase.toLocaleString("en-US", { timeZone: tz }));
    const localDay = `${localStart.getFullYear()}-${String(localStart.getMonth() + 1).padStart(2, "0")}-${String(localStart.getDate()).padStart(2, "0")}`;

    for (let slotIdx = 0; slotIdx < slotsPerDay; slotIdx++) {
      const h = slotIdx * SLOT_MINUTES;
      const localTime = `${localDay}T${String(Math.floor(h / 60)).padStart(2, "0")}:${String(h % 60).padStart(2, "0")}:00`;
      const startUtc = new Date(localTime);

      if (startUtc < now) continue;

      const endUtc = new Date(startUtc.getTime() + MS_PER_SLOT);

      try {
        await prisma.shopTimeSlot.upsert({
          where: { shopId_startTime: { shopId, startTime: startUtc } },
          create: {
            shopId,
            startTime: startUtc,
            endTime: endUtc,
            capacity: shop.capacity,
          },
          update: {},
        });
        created++;
      } catch {
        // slot exists, skip
      }
    }
  }

  return created;
}

export async function fillMissingSlots() {
  const shops = await prisma.shop.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  let total = 0;
  for (const s of shops) {
    total += await generateSlotsForShop(s.id);
  }
  return total;
}

export async function getSlotAvailability(
  shopId: string,
  from: Date,
  to: Date,
) {
  const slots = await prisma.shopTimeSlot.findMany({
    where: {
      shopId,
      startTime: { gte: from },
      endTime: { lte: to },
      isActive: true,
    },
    orderBy: { startTime: "asc" },
  });

  const slotIds: string[] = slots.map((s: { id: string }) => s.id);

  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 3600000);

  const reservations = await prisma.reservationSlot.groupBy({
    by: ["slotId"],
    where: {
      slotId: { in: slotIds },
      booking: {
        OR: [
          { status: { in: ["PAID", "CHECKED_IN", "APPROVED"] } },
          { status: { in: ["WAITING_APPROVAL", "PENDING"] }, checkInTime: { gte: cutoff } },
        ],
      },
    },
    _sum: { bagCount: true },
  });

  const reservedMap = new Map<string, number>();
  for (const r of reservations) {
    reservedMap.set(r.slotId, r._sum.bagCount ?? 0);
  }

  return slots.map((slot: { id: string; startTime: Date; endTime: Date; capacity: number }) => {
    const reserved = reservedMap.get(slot.id) ?? 0;
    return {
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
      reserved,
      available: Math.max(0, slot.capacity - reserved),
    };
  });
}

export async function reserveSlots(
  tx: Prisma.TransactionClient,
  shopId: string,
  from: Date,
  to: Date,
  totalBags: number,
) {
  const slots = await tx.shopTimeSlot.findMany({
    where: {
      shopId,
      startTime: { gte: from },
      endTime: { lte: to },
      isActive: true,
    },
    orderBy: { startTime: "asc" },
  });

  if (slots.length === 0) {
    throw new SlotAvailabilityError("No available slots for the selected time range");
  }

  const slotIds: string[] = slots.map((s: { id: string }) => s.id);
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 3600000);

  const existing = await tx.reservationSlot.groupBy({
    by: ["slotId"],
    where: {
      slotId: { in: slotIds },
      booking: {
        OR: [
          { status: { in: ["PAID", "CHECKED_IN", "APPROVED"] } },
          { status: { in: ["WAITING_APPROVAL", "PENDING"] }, checkInTime: { gte: cutoff } },
        ],
      },
    },
    _sum: { bagCount: true },
  });

  const reservedMap = new Map<string, number>();
  for (const e of existing) {
    reservedMap.set(e.slotId, e._sum.bagCount ?? 0);
  }

  for (const slot of slots) {
    const used = reservedMap.get(slot.id) ?? 0;
    if (used + totalBags > slot.capacity) {
      throw new SlotAvailabilityError(
        `Slot ${slot.startTime.toISOString()} has only ${slot.capacity - used} bags available (requested: ${totalBags})`,
      );
    }
  }

  const data = slots.map((s) => ({
    slotId: s.id,
    bagCount: totalBags,
  }));

  return { slots, data, checkInTime: slots[0].startTime, checkOutTime: slots[slots.length - 1].endTime };
}

export async function releaseSlots(
  tx: Prisma.TransactionClient,
  bookingId: string,
) {
  await tx.reservationSlot.deleteMany({ where: { bookingId } });
}

export class SlotAvailabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlotAvailabilityError";
  }
}

// ── Hourly pricing ──

export function computeSlotPricing(
  slotCount: number,
  pricePerHour: number,
  bagCountS: number,
  bagCountM: number,
  bagCountXl: number,
  bagMultiplierS: number,
  bagMultiplierM: number,
  bagMultiplierXl: number,
) {
  const hours = slotCount * (SLOT_MINUTES / 60);
  const sTotal = hours * pricePerHour * bagCountS * bagMultiplierS;
  const mTotal = hours * pricePerHour * bagCountM * bagMultiplierM;
  const xlTotal = hours * pricePerHour * bagCountXl * bagMultiplierXl;
  return Math.round((sTotal + mTotal + xlTotal) * 100) / 100;
}

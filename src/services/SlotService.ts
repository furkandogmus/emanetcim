import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { OPERATING_SHOP_FILTER } from "@/lib/public-shop-filter";
import { parseDatetimeLocalInTimeZone } from "@/lib/datetime-local";
import type { Prisma } from "@prisma/client";

export const SLOT_MINUTES = 30;
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
  // Overnight shops (close < open): e.g., bar 22:00-04:00
  const totalMins = closeMins <= openMins
    ? (closeMins + 24 * 60 - openMins)
    : (closeMins - openMins);
  return Math.max(0, Math.ceil(totalMins / SLOT_MINUTES));
}

export async function generateSlotsForShop(
  shopId: string,
  daysForward = 30,
) {
  const shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shopId },
    select: { id: true, open247: true, openingTime: true, closingTime: true, capacity: true, timezone: true },
  });

  const tz = shop.timezone || "Europe/Istanbul";
  const slotsPerDay = operatingHoursToSlots(shop.openingTime, shop.closingTime, shop.open247);
  if (slotsPerDay === 0) return 0;

  let created = 0;
  const now = new Date();

  for (let dayOffset = 0; dayOffset < daysForward; dayOffset++) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() + dayOffset);

    // Get year-month-day in shop's timezone using Intl
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const localDay = fmt.format(dayStart); // "2026-06-15"

    // Parse opening hour to get slot base in local time
    const [oh, om] = (shop.openingTime || "09:00").split(":").map(Number);
    const baseMins = oh * 60 + om;

    for (let slotIdx = 0; slotIdx < slotsPerDay; slotIdx++) {
      const slotStartMins = baseMins + slotIdx * SLOT_MINUTES;
      const h = Math.floor(slotStartMins / 60) % 24;
      const m = slotStartMins % 60;

      /*
        DÜKKANIN duvar saatini o dükkanın SAAT DİLİMİNDE bir ANA çevirir.

        NEDEN (P0, 2026-08-24'te ölçüldü): burada `new Date(localIso)` vardı ve
        üstündeki yorum "parse as UTC" diyordu. İkisi de yanlış: saat dilimi eki
        OLMAYAN bir ISO tarih-saat dizesi, çalışma ortamının YEREL saatine göre
        ayrıştırılır. Konteynerde TZ ayarlı değil, yani prod UTC:

            TZ=UTC             new Date("2026-06-15T09:00:00") -> 09:00Z
            TZ=Europe/Istanbul new Date("2026-06-15T09:00:00") -> 06:00Z   (doğrusu)

        Sonuç: 09:00–20:00 açık bir İstanbul dükkanının slotları 09:00Z–20:00Z
        olarak üretiliyordu; misafir ızgarada bunları dükkanın takviminde
        12:00–23:00 olarak görüyordu. Yani

          - dükkan AÇIKKEN (09:00–12:00) hiç slot yok — arama bile o pencerede
            dükkanı eliyor (`getSlotAvailability` boş dönüyor),
          - dükkan KAPALIYKEN (20:00–23:00) slot var; misafir rezervasyon yapıyor,
            parasını ödüyor, geliyor ve `isShopOpenAt` check-in'i REDDEDİYOR
            (`src/services/booking/check-in.ts:42`) — hata tam da tezgâhın
            başında, valizle patlıyor.

        Geliştirici makinesi İstanbul saatinde olduğu için hata YALNIZCA PROD'DA
        görünüyordu. `shopTimeZone()` yardımcısı da tanımlı ama hiç çağrılmıyordu
        — dönüşümün amaçlandığını ama hiç bağlanmadığını gösteriyor.

        `parseDatetimeLocalInTimeZone` DST sınırlarını da doğru çözüyor ve misafir
        tarafındaki tarih girdileri zaten onunla ayrıştırılıyor: iki taraf artık
        aynı fonksiyonu kullanıyor.
      */
      const localIso = `${localDay}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      const startUtc = parseDatetimeLocalInTimeZone(localIso, tz);

      if (!startUtc || isNaN(startUtc.getTime())) continue;
      if (startUtc < now) continue;

      // Handle overnight slots: if slot is in next calendar day
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
  // Talep testi noktalarina slot URETILMEZ: rezervasyon almiyorlar, dolayisiyla
  // slot bekleyen her sey (kapasite, saglik kontrolu) onlari saymamali.
  const shops = await prisma.shop.findMany({
    where: OPERATING_SHOP_FILTER,
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
  /*
    `take` bir EMNIYET SUBABI (2026-08-31). Cagiran taraf araligi zaten
    sinirliyor (`slot-availability-route.ts`, 31 gun) -- bu satir o sinirin
    unutuldugu ya da baska bir cagiranin eklendigi gunu karsiliyor. Sinirsiz bir
    `findMany`, kimlik dogrulamasi olmayan bir ucun arkasinda durmamali.

    Deger yuksek bilerek: 31 gunluk bir pencerede bu kadar slot uretilemez, yani
    normal calismada HIC devreye girmez. Devreye girerse sessizce yarim veri
    dondurmek yanlis olurdu, o yuzden loglaniyor.
  */
  const MAX_SLOTS = 5000;
  const slots = await prisma.shopTimeSlot.findMany({
    where: {
      shopId,
      startTime: { gte: from },
      endTime: { lte: to },
      isActive: true,
    },
    orderBy: { startTime: "asc" },
    take: MAX_SLOTS,
  });
  if (slots.length === MAX_SLOTS) {
    logger.warn(
      { shopId, from, to, cap: MAX_SLOTS },
      "slot_availability_result_capped",
    );
  }

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

  /**
   * ReservationSlot kaydı OLMAYAN rezervasyonlar da yer kaplar.
   *
   * Neden gerekli: slot üretimi 2026-07-14'te durduğu için rezervasyonlar aylarca
   * "legacy" yoldan (dükkan geneli kapasite kontrolü) oluşturuldu ve hiç
   * ReservationSlot satırı yazılmadı — prod'da 19 rezervasyona karşı 0 satır.
   * Slot üretimi tekrar açıldığında bu rezervasyonlar per-slot sayımda görünmezdi,
   * yani dolu bir dükkan boş görünüp FAZLA SATIŞ yapılabilirdi.
   *
   * Bu yüzden slot bazlı rezervasyonların üstüne, slot penceresiyle çakışan ve
   * kendi ReservationSlot satırı bulunmayan rezervasyonların valizleri de eklenir.
   * Kalıcı olarak doğru: yeni rezervasyonlar slot satırı yazdığı için burada
   * mükerrer sayılmazlar.
   */
  const legacyBookings = await prisma.booking.findMany({
    where: {
      shopId,
      reservationSlots: { none: {} },
      checkInTime: { lt: to },
      checkOutTime: { gt: from },
      OR: [
        { status: { in: ["PAID", "CHECKED_IN", "APPROVED"] } },
        {
          status: { in: ["WAITING_APPROVAL", "PENDING"] },
          checkInTime: { gte: cutoff },
        },
      ],
    },
    select: {
      checkInTime: true,
      checkOutTime: true,
      bagCountS: true,
      bagCountM: true,
      bagCountXl: true,
    },
  });

  const legacyBagsFor = (slotStart: Date, slotEnd: Date): number => {
    let n = 0;
    for (const b of legacyBookings) {
      if (b.checkInTime < slotEnd && b.checkOutTime > slotStart) {
        n += (b.bagCountS ?? 0) + (b.bagCountM ?? 0) + (b.bagCountXl ?? 0);
      }
    }
    return n;
  };

  return slots.map((slot: { id: string; startTime: Date; endTime: Date; capacity: number }) => {
    const reserved =
      (reservedMap.get(slot.id) ?? 0) + legacyBagsFor(slot.startTime, slot.endTime);
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

  // Lock slots to prevent race conditions
  if (slots.length > 0) {
    const slotIds = slots.map((s: { id: string }) => s.id);
    await tx.$executeRawUnsafe(
      `SELECT 1 FROM "ShopTimeSlot" WHERE id = ANY($1::text[]) FOR UPDATE`,
      [slotIds],
    );
  }

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

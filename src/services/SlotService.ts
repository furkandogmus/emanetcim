import { hoursForDate } from "@/lib/shop-schedule";
import { loadScheduleParts, type ShopScheduleParts } from "@/services/ShopScheduleService";
import { slotCalendarDays } from "@/lib/slot-calendar";
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

/**
 * Slot ufku: gece isi ve dukkan basina uretim AYNI sayiyi kullanir. Iki ayri
 * sabit olsaydi bir gun ayrisir ve gece isi, gun icinde uretilenin bir kismini
 * "fazla" sayardi.
 */
export const SLOT_HORIZON_DAYS = 30;

/** Uretimin okudugu dukkan alanlari (takvim parcalari ayri: `loadScheduleParts`). */
export type SlotPlanShop = {
  open247: boolean;
  openingTime: string | null;
  closingTime: string | null;
  timezone: string | null;
};

/**
 * Bir dukkanin ufuk icinde OLMASI GEREKEN slot baslangiclari -- saf fonksiyon.
 *
 * Gece isi (`fillMissingSlots`) ve dukkan basina uretim (`generateSlotsForShop`)
 * ayni plani kullanir: haftalik saat, 7/24, izin gunleri ve saat dilimi kurali
 * TEK yerde. `windowStart`/`windowEnd`: planin kapsadigi takvim gunlerinin dukkan
 * saatindeki sinirlari; uzlastirma yalnizca bu araliktaki slotlara dokunur.
 */
export function planSlotStarts(
  shop: SlotPlanShop,
  parts: Partial<ShopScheduleParts> | undefined,
  now: Date,
  horizonDays: number = SLOT_HORIZON_DAYS,
): { starts: Date[]; windowEnd: Date | null } {
  const tz = shop.timezone || "Europe/Istanbul";
  const schedule = {
    open247: shop.open247,
    openingTime: shop.openingTime,
    closingTime: shop.closingTime,
    timeZone: tz,
    ...parts,
  };

  const starts: Date[] = [];
  const takvimGunleri = slotCalendarDays(now, tz, horizonDays);

  for (const localDay of takvimGunleri) {
    // Gunun kendi saati: haftalik satir ya da izin gunu (null = o gun slot yok).
    const dayHours = hoursForDate(schedule, localDay);
    if (!dayHours) continue;
    const slotsPerDay = operatingHoursToSlots(dayHours.open, dayHours.close, shop.open247);
    const [oh, om] = dayHours.open.split(":").map(Number);
    const baseMins = oh * 60 + om;

    for (let slotIdx = 0; slotIdx < slotsPerDay; slotIdx++) {
      const slotStartMins = baseMins + slotIdx * SLOT_MINUTES;
      // Gece yarisini asan vardiya ayni takvim gununun sabahina sarar (gece isinin
      // 2026-11-23 oncesi davranisi aynen korunuyor).
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
      starts.push(startUtc);
    }
  }

  const lastDay = takvimGunleri[takvimGunleri.length - 1];
  const windowEnd = lastDay
    ? parseDatetimeLocalInTimeZone(`${addCalendarDays(lastDay, 1)}T00:00:00`, tz)
    : null;
  return { starts, windowEnd };
}

function addCalendarDays(ymd: string, n: number): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * - `fill`: yalnizca EKSIK slotu yazar, mevcut satira dokunmaz. Gece isinin
 *   davranisi (eskiden `upsert(update: {})`).
 * - `reconcile`: eksikleri yazar, ufuk icindeki REZERVASYONSUZ gelecek slotlari
 *   yeni takvime ve kapasiteye cekir. Saat/izin/kapasite degisince kullanilir.
 */
export type SlotGenerationMode = "fill" | "reconcile";

export type SlotGenerationResult = {
  created: number;
  reactivated: number;
  deactivated: number;
  capacityUpdated: number;
  /** Uretim yapilmadi: dukkan yok ya da isletilmiyor (pasif / test / talep testi). */
  skipped?: "not_found" | "not_operating";
};

const EMPTY_RESULT: Omit<SlotGenerationResult, "skipped"> = {
  created: 0,
  reactivated: 0,
  deactivated: 0,
  capacityUpdated: 0,
};

/**
 * TEK DUKKANIN slotlarini hemen uretir -- gece isini beklemeden.
 *
 * NEDEN (2026-11-23 olayi): yeni onaylanan bir dukkan web aramasinda hic
 * cikmadi, cunku `ShopTimeSlot` satiri sifirdi. Slotlari yalnizca gece 04:17
 * isi uretiyordu ve o is haftalardir basarisizdi; web aramasi slot dalinda
 * slotu olmayan dukkani eliyor (`findShopsForSearch`). Mobil yakindakiler
 * kapasite yolunu kullandigi icin dukkan orada gorunuyordu -- yani sorun
 * yalnizca web'de, sessizce.
 *
 * Kurallar:
 *   - Plan gece isiyle AYNI (`planSlotStarts`, `SLOT_HORIZON_DAYS`).
 *   - Yalnizca isletilen dukkan (`OPERATING_SHOP_FILTER`): pasif, test ve talep
 *     testi noktasina slot yazilmaz -- gece isi de yazmiyor.
 *   - Idempotent: `@@unique([shopId, startTime])` + `createMany(skipDuplicates)`;
 *     iki kez cagirmak ikinci kez hicbir sey yazmaz.
 *   - Es zamanli guvenli: dukkan basina `pg_advisory_xact_lock`. Gece isi de ayni
 *     kilidi alir; takvim KILIT ALTINDA okunur, yani eski takvimle calisan bir tur
 *     yeni takvimin uzerine yazamaz.
 *   - Rezervasyonu olan slot SILINMEZ ve DEGISTIRILMEZ. Takvim disina dusen
 *     rezervasyonsuz slot silinmez, `isActive=false` olur: `ReservationSlot`
 *     slot silinince cascade ile silinir, yani yarista yeni alinmis bir
 *     rezervasyonun slot defteri sessizce kaybolabilirdi.
 */
export async function generateSlotsForShop(
  shopId: string,
  opts: { horizonDays?: number; mode?: SlotGenerationMode; now?: Date } = {},
): Promise<SlotGenerationResult> {
  const horizonDays = opts.horizonDays ?? SLOT_HORIZON_DAYS;
  const mode = opts.mode ?? "reconcile";
  const now = opts.now ?? new Date();

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-slots:${shopId}`})::bigint)`;

      const shop = await tx.shop.findUnique({
        where: { id: shopId },
        select: {
          id: true,
          open247: true,
          openingTime: true,
          closingTime: true,
          capacity: true,
          timezone: true,
          isActive: true,
          isTest: true,
          isPrelaunch: true,
        },
      });
      if (!shop) return { ...EMPTY_RESULT, skipped: "not_found" as const };
      if (
        shop.isActive !== OPERATING_SHOP_FILTER.isActive ||
        shop.isTest !== OPERATING_SHOP_FILTER.isTest ||
        shop.isPrelaunch !== OPERATING_SHOP_FILTER.isPrelaunch
      ) {
        return { ...EMPTY_RESULT, skipped: "not_operating" as const };
      }

      const parts = (await loadScheduleParts([shopId], undefined, tx)).get(shopId);
      const { starts, windowEnd } = planSlotStarts(shop, parts, now, horizonDays);

      const { count: created } = starts.length
        ? await tx.shopTimeSlot.createMany({
            data: starts.map((startTime) => ({
              shopId,
              startTime,
              endTime: new Date(startTime.getTime() + MS_PER_SLOT),
              capacity: shop.capacity,
            })),
            skipDuplicates: true,
          })
        : { count: 0 };

      if (mode === "fill" || !windowEnd) return { ...EMPTY_RESULT, created };

      /*
        Uzlastirma. Once ufuktaki gelecek slotlar KILITLENIR (rezervasyon akisi
        `reserveSlots` ayni satirlari FOR UPDATE ile kilitliyor), sonra
        rezervasyon defteri kilit ALTINDA okunur: READ COMMITTED'da her ifade
        taze goruntu alir, yani kilidi bekledigimiz sirada islenen rezervasyon
        burada gorunur ve o slota dokunulmaz.
      */
      const future = await tx.$queryRaw<
        Array<{ id: string; startTime: Date; capacity: number; isActive: boolean }>
      >`SELECT id, "startTime", capacity, "isActive" FROM "ShopTimeSlot"
         WHERE "shopId" = ${shopId} AND "startTime" >= ${now} AND "startTime" < ${windowEnd}
         FOR UPDATE`;
      if (future.length === 0) return { ...EMPTY_RESULT, created };

      const booked = new Set(
        (
          await tx.reservationSlot.findMany({
            where: { slotId: { in: future.map((f) => f.id) } },
            select: { slotId: true },
            distinct: ["slotId"],
          })
        ).map((r) => r.slotId),
      );
      const wanted = new Set(starts.map((d) => d.getTime()));

      const toDeactivate: string[] = [];
      const toReactivate: string[] = [];
      const toResize: string[] = [];
      for (const slot of future) {
        if (booked.has(slot.id)) continue;
        const keep = wanted.has(new Date(slot.startTime).getTime());
        if (!keep) {
          if (slot.isActive) toDeactivate.push(slot.id);
          continue;
        }
        if (!slot.isActive) toReactivate.push(slot.id);
        else if (slot.capacity !== shop.capacity) toResize.push(slot.id);
      }

      if (toDeactivate.length) {
        await tx.shopTimeSlot.updateMany({ where: { id: { in: toDeactivate } }, data: { isActive: false } });
      }
      if (toReactivate.length) {
        await tx.shopTimeSlot.updateMany({
          where: { id: { in: toReactivate } },
          data: { isActive: true, capacity: shop.capacity },
        });
      }
      if (toResize.length) {
        await tx.shopTimeSlot.updateMany({ where: { id: { in: toResize } }, data: { capacity: shop.capacity } });
      }

      return {
        created,
        deactivated: toDeactivate.length,
        reactivated: toReactivate.length,
        capacityUpdated: toResize.length,
      };
    },
    // Ufukta en fazla ~1.440 satir (30 gun x 48); varsayilan 5 sn kisa kalabilir.
    { timeout: 30_000, maxWait: 10_000 },
  );
}

/**
 * Dukkan basina uretimi ates-ve-unut olarak baslatir; hata HER ZAMAN loglanir.
 *
 * Onay, aktiflestirme ve takvim degisikligi bunu cagirir: slot hatasi asil
 * islemi (onay, kayit) asla dusurmez; kacan dukkani gece isi yakalar.
 */
export function scheduleSlotGeneration(shopId: string, reason: string): void {
  void generateSlotsForShop(shopId)
    .then((r) => {
      if (r.skipped) return;
      logger.info({ shopId, reason, ...r }, "shop_slot_generation_done");
    })
    .catch((err: unknown) => logger.warn({ err, shopId, reason }, "shop_slot_generation_failed"));
}

/**
 * Gece isi: isletilen her dukkan icin EKSIK slotlari uretir (`fill`).
 *
 * Bir dukkanin hatasi digerlerini durdurmaz -- eskiden ilk hata butun turu
 * kesiyordu ve listenin geri kalani o gece slot almiyordu. Hata varsa tur
 * sonunda firlatilir: `withJobRun` isi basarisiz yazar, saglik kontrolu gorur.
 */
export async function fillMissingSlots() {
  // Talep testi noktalarina slot URETILMEZ: rezervasyon almiyorlar, dolayisiyla
  // slot bekleyen her sey (kapasite, saglik kontrolu) onlari saymamali.
  const shops = await prisma.shop.findMany({
    where: OPERATING_SHOP_FILTER,
    select: { id: true },
  });
  let total = 0;
  const failed: string[] = [];
  for (const s of shops) {
    try {
      total += (await generateSlotsForShop(s.id, { mode: "fill" })).created;
    } catch (err) {
      failed.push(s.id);
      logger.error({ err, shopId: s.id }, "generate_slots_shop_failed");
    }
  }
  if (failed.length > 0) {
    throw new Error(`generate_slots_failed_for_${failed.length}_of_${shops.length}_shops`);
  }
  return total;
}

export type SlotAvailability = {
  id: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  reserved: number;
  available: number;
};

/**
 * Tek sorguda donebilecek en fazla slot. Emniyet subabi -- cagiran taraf
 * araligi zaten sinirliyor (`slot-availability-route.ts`, 31 gun).
 */
const MAX_SLOTS_PER_QUERY = 5000;

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
  const MAX_SLOTS = MAX_SLOTS_PER_QUERY;
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

/**
 * COK DUKKAN icin slot musaitligi — TEK sorgu setiyle.
 *
 * NEDEN VAR (2026-08-31'de olculdu): `findShopsForSearch` sunu yapiyordu:
 *
 *     for (const shop of operating) {
 *       const slots = await getSlotAvailability(shop.id, checkIn, checkOut);
 *       ...
 *     }
 *
 * `operating` yuz dukkana kadar cikabiliyor (`getActiveShopsOrderedByDistanceKm`
 * `take: 100` ile cagriliyor) ve `getSlotAvailability` dukkan basina UC sorgu
 * kosuyor: slot listesi, `ReservationSlot` toplami ve eski yoldan acilmis
 * rezervasyonlar. Yani TEK BIR ARAMA ISTEGI, sirayla, uc yuze varan
 * gidis-donus uretiyordu -- sitenin en cok trafik alan sayfasinda ve kimlik
 * dogrulamasi olmadan.
 *
 * Paralellestirmek yetmezdi: yuz es zamanli sorgu bu sefer baglanti havuzunu
 * (`PG_POOL_MAX`, varsayilan 10) doldurur ve diger istekleri bekletirdi. Dogru
 * cozum sorgu SAYISINI dusurmek: uc sorgu, kac dukkan olursa olsun.
 *
 * Anlam `getSlotAvailability` ile BIREBIR AYNI -- ozellikle "kendi
 * `ReservationSlot` satiri olmayan rezervasyonlar da yer kaplar" kurali, ki o
 * kural fazla satisi onleyen sey (gerekcesi `getSlotAvailability` icinde).
 */
export async function getSlotAvailabilityForShops(
  shopIds: string[],
  from: Date,
  to: Date,
): Promise<Map<string, SlotAvailability[]>> {
  const result = new Map<string, SlotAvailability[]>();
  if (shopIds.length === 0) return result;

  const slots = await prisma.shopTimeSlot.findMany({
    where: {
      shopId: { in: shopIds },
      startTime: { gte: from },
      endTime: { lte: to },
      isActive: true,
    },
    orderBy: { startTime: "asc" },
    take: MAX_SLOTS_PER_QUERY,
  });
  if (slots.length === MAX_SLOTS_PER_QUERY) {
    logger.warn(
      { shopCount: shopIds.length, from, to, cap: MAX_SLOTS_PER_QUERY },
      "slot_availability_batch_result_capped",
    );
  }
  if (slots.length === 0) return result;

  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 3600000);

  const [reservations, legacyBookings] = await Promise.all([
    prisma.reservationSlot.groupBy({
      by: ["slotId"],
      where: {
        slotId: { in: slots.map((s) => s.id) },
        booking: {
          OR: [
            { status: { in: ["PAID", "CHECKED_IN", "APPROVED"] } },
            { status: { in: ["WAITING_APPROVAL", "PENDING"] }, checkInTime: { gte: cutoff } },
          ],
        },
      },
      _sum: { bagCount: true },
    }),
    prisma.booking.findMany({
      where: {
        shopId: { in: shopIds },
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
        shopId: true,
        checkInTime: true,
        checkOutTime: true,
        bagCountS: true,
        bagCountM: true,
        bagCountXl: true,
      },
    }),
  ]);

  const reservedMap = new Map<string, number>();
  for (const r of reservations) {
    reservedMap.set(r.slotId, r._sum.bagCount ?? 0);
  }

  const legacyByShop = new Map<string, typeof legacyBookings>();
  for (const b of legacyBookings) {
    const list = legacyByShop.get(b.shopId) ?? [];
    list.push(b);
    legacyByShop.set(b.shopId, list);
  }

  for (const slot of slots) {
    const legacy = legacyByShop.get(slot.shopId) ?? [];
    let legacyBags = 0;
    for (const b of legacy) {
      if (b.checkInTime < slot.endTime && b.checkOutTime > slot.startTime) {
        legacyBags += (b.bagCountS ?? 0) + (b.bagCountM ?? 0) + (b.bagCountXl ?? 0);
      }
    }
    const reserved = (reservedMap.get(slot.id) ?? 0) + legacyBags;
    const list = result.get(slot.shopId) ?? [];
    list.push({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
      reserved,
      available: Math.max(0, slot.capacity - reserved),
    });
    result.set(slot.shopId, list);
  }

  return result;
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

/**
 * Bir rezervasyonun SLOT DEFTERINDEKI valiz sayisini gunceller.
 *
 * NEDEN VAR (2026-09-02'de olculdu): valiz duzeltmesi (`applyBagRevision`)
 * `Booking.bagCountS/M/XL`i guncelliyor ama slot defterine hic dokunmuyordu.
 * Musaitlik hesabi ise slot tabanli rezervasyonlarda `ReservationSlot.bagCount`
 * TOPLAMINI okuyor (`getSlotAvailabilityForShops`); `Booking.bagCount*`
 * yalnizca slotu OLMAYAN eski kayitlar icin kullaniliyor.
 *
 * Sonuc, kapasitenin IKI KEZ SATILMASI:
 *
 *   kapasite 10 · misafir A 2 valizle rezerve eder   -> slot defteri: 2
 *   esnaf duzeltmeyle 8 valize cikarir               -> Booking: 8, defter: 2
 *   sistem 8 valizlik yer bos sanir                  -> misafir B 8 valiz alir
 *   dukkanda 16 valiz, kapasite 10
 *
 * Tasma tezgahin basinda ortaya cikar ve kimse onu bir yazilim hatasi olarak
 * gormez -- "bugun cok yogunuz" gibi gorunur.
 *
 * KAPASITE KONTROLU DE BURADA. `applyBagRevision` hicbir sinir bakmiyordu:
 * esnaf valiz sayisini kapasitenin ustune cikarabiliyordu. Sayimdan bu
 * rezervasyonun KENDI payi dusuluyor, yoksa kendi valizleri iki kez sayilir.
 *
 * Statu kumesi `reserveSlots`taki ile AYNI: iki yer ayni "yer kapliyor mu"
 * sorusunu soruyor, ayri tanimlari olamaz.
 */
export async function updateReservedBags(
  tx: Prisma.TransactionClient,
  bookingId: string,
  newTotalBags: number,
): Promise<{ ok: true } | { ok: false; slotStart: Date; available: number }> {
  const rows = await tx.reservationSlot.findMany({
    where: { bookingId },
    select: {
      slotId: true,
      slot: { select: { capacity: true, startTime: true } },
    },
  });
  // Slotu olmayan (eski) rezervasyon: defter zaten `Booking.bagCount*`tan
  // okunuyor, guncellenecek satir yok.
  if (rows.length === 0) return { ok: true };

  const slotIds = rows.map((r) => r.slotId);
  const cutoff = new Date(Date.now() - 24 * 3600000);

  const digerleri = await tx.reservationSlot.groupBy({
    by: ["slotId"],
    where: {
      slotId: { in: slotIds },
      // KENDI payi haric: yoksa kendi valizlerini iki kez sayardik.
      bookingId: { not: bookingId },
      booking: {
        OR: [
          { status: { in: ["PAID", "CHECKED_IN", "APPROVED"] } },
          { status: { in: ["WAITING_APPROVAL", "PENDING"] }, checkInTime: { gte: cutoff } },
        ],
      },
    },
    _sum: { bagCount: true },
  });

  const doluluk = new Map<string, number>();
  for (const d of digerleri) doluluk.set(d.slotId, d._sum.bagCount ?? 0);

  for (const r of rows) {
    const baskalari = doluluk.get(r.slotId) ?? 0;
    if (baskalari + newTotalBags > r.slot.capacity) {
      return {
        ok: false,
        slotStart: r.slot.startTime,
        available: Math.max(0, r.slot.capacity - baskalari),
      };
    }
  }

  await tx.reservationSlot.updateMany({
    where: { bookingId },
    data: { bagCount: newTotalBags },
  });
  return { ok: true };
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

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { shopService } from "@/services/ShopService";
import { computeAuthoritativeCheckoutTotals, validateBookingStayWindow } from "@/lib/booking-server-price";
import { moneyToNumber } from "@/lib/money";
import { getPricingRules } from "@/lib/platform-settings";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
import { toMobilePriceRange, toMobileShop, toMobileStayQuote } from "@/lib/mobile-dto";
import { toDatetimeLocalValueInTimeZone } from "@/lib/datetime-local";
import { nextOpening, snapStayToShopHours } from "@/lib/stay-days";
import logger from "@/lib/logger";
import { loadScheduleParts } from "@/services/ShopScheduleService";

const MAX_RADIUS_M = 50_000;
const MAX_LIMIT = 50;

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  /** Metre. Kimliksiz uc: 50 km'ye kirpilir (CR-nearby-clamp); sehir karti yaricapi sinirsiz olabilir, reddedilmez. */
  r: z.coerce.number().default(5000).transform((v) => Math.min(Math.max(v, 100), MAX_RADIUS_M)),
  page: z.coerce.number().int().default(1).transform((v) => Math.min(Math.max(v, 1), 1000)),
  limit: z.coerce.number().int().default(20).transform((v) => Math.min(Math.max(v, 1), MAX_LIMIT)),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  bags: z.coerce.number().int().min(1).max(200).optional(),
  /**
   * Boy basina adet (yeni istemci). Gelirse her sonuca `stayQuote` eklenir; sinir
   * `checkout/quote` ile ayni. Eski istemci yalnizca `bags` gonderir, yanit degismez.
   */
  bagsS: z.coerce.number().int().min(0).max(20).optional(),
  bagsM: z.coerce.number().int().min(0).max(20).optional(),
  bagsXl: z.coerce.number().int().min(0).max(20).optional(),
  /**
   * Yeni istemci "saate oturmayan dukkanlari da gonder" der (`bookable:false`).
   * Eski surumler bu alani gondermez ve bilmedikleri alani yok sayar; onlara
   * kapali dukkan normal kart gibi gorunup odemede patlardi, bu yuzden onlar icin
   * eskisi gibi listeden cikarilir.
   */
  includeClosed: z.enum(["1", "true"]).optional(),
});

export async function GET(req: NextRequest) {
  const ip = await getClientIp(req);
  if (!(await rateLimit(`mobile_shops_nearby:${ip}`, 30, 60_000))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { lat, lng, r, page, limit, checkIn, checkOut, bags, bagsS, bagsM, bagsXl, includeClosed } = parsed.data;
  const mix =
    bagsS !== undefined || bagsM !== undefined || bagsXl !== undefined
      ? { s: bagsS ?? 0, m: bagsM ?? 0, xl: bagsXl ?? 0 }
      : null;
  const mixTotal = mix ? mix.s + mix.m + mix.xl : 0;

  const radiusKm = r / 1000;

  if (checkIn && checkOut) {
    const rules = await getPricingRules();
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    if (!validateBookingStayWindow(ci, co, rules)) {
      return NextResponse.json({ error: "invalid_dates" }, { status: 400 });
    }
    const requestedBags = mixTotal > 0 ? mixTotal : Math.max(1, Math.floor(bags ?? 1));
    let results;
    try {
      results = await shopService.findShopsForSearch({
        centerLat: lat,
        centerLng: lng,
        radiusKm,
        checkIn: ci,
        checkOut: co,
        requestedBags,
        /*
          Saat kapisi BURADA uygulanmaz (2026-11-18): misafirin sectigi anda kapali
          olan dukkan eskiden listeden dusuyordu, misafir varligini bile bilmiyordu.
          Artik listelenir ve saat dukkanin saatine oturtulur; ayni kural
          rezervasyonda da uygulanir (checkout/intent).
        */
        ignoreOpenHours: true,
        strict: true,
        includeOutsideHours: !!includeClosed,
        /*
          Web aramasiyla (`actions/search-shops.ts`) ayni gun kapisi: haftalik
          takvim ve kapanislar. Yoksa pazar gunu kapali ya da o tarihte izinli
          dukkan haritada cikiyor, misafir ancak odeme adiminda
          `shop_closed_on_date` aliyordu. Gunler platform saatiyle.
        */
        stayDays: {
          drop: toDatetimeLocalValueInTimeZone(ci).slice(0, 10),
          pickup: toDatetimeLocalValueInTimeZone(co).slice(0, 10),
        },
      });
    } catch (err) {
      logger.error({ err }, "mobile_nearby_search_failed");
      return NextResponse.json({ error: "search_unavailable" }, { status: 503 });
    }
    const schedules = await loadScheduleParts(
      results.map((s) => s.id),
      toDatetimeLocalValueInTimeZone(ci).slice(0, 10),
    );
    const open = [];
    const closed = [];
    for (const s of results) {
      const base = {
        ...toMobileShop(s),
        /* Aramaya OZGU alanlar: ortak govdeye girmez, listede anlamli. */
        distanceKm: s.distanceKm,
        bagsAvailable: s.bagsAvailable,
        priceRange: toMobilePriceRange(s.pricePerDay, rules),
      };
      if (s.isPrelaunch) {
        open.push({ ...base, bookable: true, hoursNotice: null });
        continue;
      }
      const schedule = {
        open247: s.open247,
        openingTime: s.openingTime,
        closingTime: s.closingTime,
        timeZone: s.timezone,
        ...schedules.get(s.id),
      };
      const snapped = snapStayToShopHours(schedule, ci, co);
      if (!snapped) {
        // Birakis kapanistan sonra, kapali gun ya da kalan sure cok kisa: rezervasyon
        // acilamaz. Yeni istemciye sonraki gercek acilisla gonderilir, eskiye gonderilmez.
        if (includeClosed) {
          closed.push({ ...base, bookable: false, hoursNotice: null, nextOpen: nextOpening(schedule, ci) });
        }
        continue;
      }
      open.push({
        ...base,
        bookable: true,
        /*
          Odeme ekraniyla AYNI hesap ve AYNI oturtulmus pencere (`checkout/quote`):
          listede gorulen toplam, kod girilmemis odeme toplamidir.
        */
        ...(mix && mixTotal > 0
          ? {
              stayQuote: toMobileStayQuote(
                computeAuthoritativeCheckoutTotals(
                  moneyToNumber(s.pricePerDay),
                  mix.s,
                  mix.m,
                  mix.xl,
                  snapped.checkIn,
                  snapped.checkOut,
                  rules,
                ),
              ),
            }
          : {}),
        hoursNotice: snapped.drop || snapped.pickup ? { drop: snapped.drop ?? null, pickup: snapped.pickup ?? null } : null,
      });
    }
    // Rezervasyon alabilenler once; kendi icinde sunucunun siralamasi korunur.
    const items = [...open, ...closed].slice((page - 1) * limit, page * limit);
    return NextResponse.json(items);
  }

  const [shops, rules] = await Promise.all([
    shopService.findNearby(lat, lng, radiusKm, page, limit),
    getPricingRules(),
  ]);
  return NextResponse.json(
    shops.map((s) => ({
      ...toMobileShop(s),
      distanceKm: s.distanceKm,
      priceRange: toMobilePriceRange(s.pricePerDay, rules),
    })),
  );
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { shopService, priceBand, type ShopSettingsInput } from "@/services/ShopService";
import { shopGalleryService } from "@/services/ShopGalleryService";
import { toMobileGalleryImage, toMobilePartnerShop } from "@/lib/mobile-dto";
import prisma from "@/lib/db";
import { getPricingRules } from "@/lib/platform-settings";
import logger from "@/lib/logger";

const shopUpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  capacity: z.number().int().min(1).max(10000).optional(),
  pricePerDay: z.number().min(1).max(100000).optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  /*
    ADRES ALANLARI (2026-09-02'de eklendi).

    Mobil esnaf ayarlar ekrani bu ucu `address`, `city` ve `district` ile
    cagiriyordu (`partner_settings_screen.dart`), ama sema uctunu de
    tanimlamiyordu -- zod onlari sessizce ATIYOR, asagidaki `data` da
    yazmiyordu. Esnaf adresini duzeltir, "kaydedildi" yanitini alir ve HICBIR
    SEY degismezdi.

    Adres misafirin dukkani buldugu metin: yanlis kalan bir adres, misafiri
    yanlis kapiya gonderir. Web tarafi (`actions/shop.ts`) uc alani da kabul
    ediyordu; sinirlar oradan alindi.
  */
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  /*
    Konum pini: web formuyla ayni aralik. Iki alan BIRLIKTE gelir (yalniz enlem
    yazilirsa pin baska bir yere kayar); null ikisini birden siler. 0,0 bir
    "secilmedi" degeridir, gercek dukkan degil: reddedilir.
  */
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
}).refine((d) => (d.latitude === undefined) === (d.longitude === undefined), {
  message: "coordinates_pair",
  path: ["latitude"],
}).refine((d) => (d.latitude === null) === (d.longitude === null), {
  message: "coordinates_pair",
  path: ["latitude"],
}).refine((d) => !(d.latitude === 0 && d.longitude === 0), {
  message: "coordinates_unset",
  path: ["latitude"],
});

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER"]);
  if (forbid) return forbid;

  const shop = await shopService.getShopByOwner(auth.user.id, req.nextUrl.searchParams.get("shop"));

  if (!shop) {
    return NextResponse.json({ error: "no_shop" }, { status: 404 });
  }

  const sealCount = await prisma.seal.count({
    where: { shopId: shop.id, status: "ASSIGNED" }
  });

  /*
    TELEFON `User`DA, `Shop`TA DEGIL (2026-09-02'de bulundu).

    Esnaf ayarlar ekrani bu uctan okuyup telefon alanini dolduruyor:

        res.data['phone'] ?? res.data['phoneNumber'] ?? ''

    ...ama yanit `...shop` yayilimindan olusuyor ve `Shop` modelinde `phone`
    alani YOK -- telefon dukkanin degil, SAHIBIN alani. Sonuc: esnafin kayitli
    bir telefonu olsa bile ayarlar ekrani her acilisinda alan BOS geliyordu.
    Yazma yolu ayri bir ucta (`PUT /partner/phone`) ve calisiyor; yani esnaf
    telefonunu yazabiliyor ama okuyamiyordu.

    Silme riski yok: istemci bos alani gondermiyor (`if (_phone.text.isNotEmpty)`).
  */
  const owner = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { phone: true },
  });

  const [gallery, weeklyRows] = await Promise.all([
    shopGalleryService.list(shop.id),
    prisma.shopWeeklyHours.count({ where: { shopId: shop.id } }),
  ]);

  /*
    Kurulum ozeti (2026-11-18): prod'da 12 isletilen dukkandan 9'unun
    fotografi yoktu ve 9'u hala sema varsayilani 09:00-20:00 saatindeydi
    (haftalik program hic girilmemis). Esnaf panosu bunu "dukkanini tamamla"
    listesi olarak gosterir. Saat "girilmis" = 7/24, haftalik program ya da
    varsayilandan farkli acilis/kapanis.
  */
  const hoursConfigured =
    shop.open247 || weeklyRows > 0 || shop.openingTime !== "09:00" || shop.closingTime !== "20:00";

  /* Fiyat bandi istemciye SUNUCUDAN gider: fiyat istemcide hesaplanmaz, bant da. */
  const rules = await getPricingRules();

  return NextResponse.json(
    toMobilePartnerShop(shop, {
      sealCount,
      phone: owner?.phone ?? null,
      gallery: gallery.map(toMobileGalleryImage),
      setup: { hasPhoto: !!shop.image, hoursConfigured },
      requireSealsOnCheckIn: rules.requireSealsOnCheckIn === true,
      priceRange: priceBand(rules),
    }),
  );
}

export async function PUT(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER"]);
  if (forbid) return forbid;

  const shop = await shopService.getShopByOwner(auth.user.id, req.nextUrl.searchParams.get("shop"));

  if (!shop) {
    return NextResponse.json({ error: "no_shop" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = shopUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input", details: parsed.error.flatten() }, { status: 400 });
    }

    const data: ShopSettingsInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.capacity !== undefined) data.capacity = parsed.data.capacity;
    if (parsed.data.pricePerDay !== undefined) data.pricePerDay = parsed.data.pricePerDay;
    if (parsed.data.openingTime !== undefined) data.openingTime = parsed.data.openingTime;
    if (parsed.data.closingTime !== undefined) data.closingTime = parsed.data.closingTime;
    if (parsed.data.address !== undefined) data.address = parsed.data.address;
    if (parsed.data.city !== undefined) data.city = parsed.data.city;
    if (parsed.data.district !== undefined) data.district = parsed.data.district;
    if (parsed.data.latitude !== undefined) data.latitude = parsed.data.latitude;
    if (parsed.data.longitude !== undefined) data.longitude = parsed.data.longitude;

    /* Bant + etki + yazma serviste (web action'iyla ayni govde). */
    const result = await shopService.updateSettings(shop.id, data);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason, min: result.min, max: result.max },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ...toMobilePartnerShop(result.shop),
      impact: {
        bookingsOutsideHours: result.impact.bookingsOutsideHours,
        bagsOverCapacity: result.impact.bagsOverCapacity,
      },
    });
  } catch (error) {
    /*
      Ham hata metni İSTEMCİYE GİTMEZ (2026-08-25). `String(e)` bir Prisma
      sorgusunu, dosya yolunu veya şema adını dışarı taşıyabiliyordu; ayrıca
      hiçbir yere loglanmadığı için gerçek sebep de kayboluyordu. Sebep log'a,
      istemciye sabit bir kod.
    */
    logger.error({ err: error }, "mobile_partner_shop_update_failed");
    return NextResponse.json({ error: "shop_update_failed" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";
import { shopService } from "@/services/ShopService";
import prisma from "@/lib/db";
import logger from "@/lib/logger";

const shopUpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  capacity: z.number().int().min(1).max(10000).optional(),
  pricePerDay: z.number().min(1).max(100000).optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER"]);
  if (forbid) return forbid;

  const shop = await shopService.getShopByOwner(auth.user.id);

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
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

  return NextResponse.json({
    ...shop,
    pricePerDay: Number(shop.pricePerDay),
    sealCount,
    phone: owner?.phone ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const forbid = requireRole(auth.user, ["PARTNER"]);
  if (forbid) return forbid;

  const shop = await shopService.getShopByOwner(auth.user.id);

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = shopUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input", details: parsed.error.flatten() }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.capacity !== undefined) data.capacity = parsed.data.capacity;
    if (parsed.data.pricePerDay !== undefined) data.pricePerDay = new Prisma.Decimal(parsed.data.pricePerDay);
    if (parsed.data.openingTime !== undefined) data.openingTime = parsed.data.openingTime;
    if (parsed.data.closingTime !== undefined) data.closingTime = parsed.data.closingTime;

    const updated = await shopService.updateShop(shop.id, data);

    return NextResponse.json(updated);
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

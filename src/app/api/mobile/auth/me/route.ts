import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { requireMobileUser } from "@/lib/mobile-auth";
import { toMobileUser } from "@/lib/mobile-dto";
import { partnerProfileService } from "@/services/PartnerProfileService";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import logger from "@/lib/logger";

/**
 * Profil GOVDESI bu ucun kendi sorgusu (2026-08-31).
 *
 * `requireMobileUser` artik yalnizca kimligi (`id`/`role`/`email`) tasiyor:
 * onceden butun `User` satirini cekiyordu ve `image` sutunu 2,7 MB'a varan bir
 * base64 data URL olabildigi icin HER yetkili istek o metni bosuna okuyordu.
 * Avatari ve profil alanlarini gercekten dondiren tek uc burasi; bedeli de
 * burada odenmeli.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const profile = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      image: true,
      emailVerified: true,
    },
  });
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json(toMobileUser(profile));
}

export async function PUT(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;
    if (!file) {
      return NextResponse.json({ error: "no_file" }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const updated = await prisma.user.update({
      where: { id: auth.user.id },
      data: { image: dataUrl },
    });

    return NextResponse.json({
      success: true,
      avatarUrl: updated.image,
    });
  }

  const { name, phone, image } = await req
    .json()
    .catch(() => ({ name: undefined, phone: undefined, image: undefined }));

  const data: Record<string, unknown> = {};
  let phoneChange: string | null | undefined;

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    }
    data.name = name.trim();
  }

  if (phone !== undefined) {
    /*
      TELEFON NORMALIZE EDILMEDEN YAZILIYORDU (2026-08-31'de bulundu).

      Bu uc gelen degeri oldugu gibi `User.phone`a yaziyordu, oysa giris ve OTP
      yollari numarayi ON HANEYE indirip UC bicimi birden ariyor:

        OR: [{ phone: "5xx…" }, { phone: "+905xx…" }, { phone: "05xx…" }]

      ...ve bunu `findFirst` ile, SIRALAMA OLMADAN yapiyor. Yani ayni numaranin
      iki farkli bicimi iki AYRI satirda durabiliyordu (`@unique` bunlari farkli
      dizeler saydigi icin engellemiyor) ve girisin hangi satiri buldugu
      belirsizdi: gercek sahibi kendi numarasi ve kendi sifresiyle giremeyebilir.

      Kural: telefon yalnizca `normalizeTrGsm10` biciminde saklanir. Bosaltma
      (`""` / `null`) de acikca desteklenir.
    */
    if (phone !== null && typeof phone !== "string") {
      return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
    }
    phoneChange = phone;
  }

  // Yalnizca kaldirma: yeni fotograf multipart dalindan gelir.
  if (image === null) data.image = null;

  if (Object.keys(data).length === 0 && phoneChange === undefined) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  try {
    /*
      Yazma ve giris-kilidi korumasi `PartnerProfileService`te (esnaf ucuyla
      ayni govde). E-postasi/baska girisi olmayan hesabin telefonu silinemez
      ya da degistirilemez. Hata esleme ile log burada, tek try icinde; telefon
      ONCE yazilir cunku is kurali redleri (kilit, cakisma) hicbir sey yazmadan
      doner: ad/fotograf yarim kalmaz.
    */
    if (phoneChange !== undefined) {
      const result = await partnerProfileService.updatePhone(auth.user.id, phoneChange);
      if (!result.ok) {
        if (result.reason === "already_registered") {
          return NextResponse.json({ error: "phone_taken" }, { status: 409 });
        }
        if (result.reason === "login_phone_locked") {
          return NextResponse.json({ error: "phone_locked" }, { status: 409 });
        }
        return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
      }
    }
    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: auth.user.id }, data });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    /*
      Numara baskasinda kayitliysa bu bir SUNUCU hatasi degil, cakismadir.
      Onceki hali her seyi `500 server_error`a cevirdigi icin kullanici
      "numaram baskasinda" bilgisini hic gormuyordu.
    */
    if (isPrismaUniqueViolation(err)) {
      return NextResponse.json({ error: "phone_taken" }, { status: 409 });
    }
    logger.error({ err, userId: auth.user.id }, "mobile_profile_update_failed");
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

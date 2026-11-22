import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { forbidWhileImpersonating, requireMobileUser } from "@/lib/mobile-auth";
import { toMobileUser } from "@/lib/mobile-dto";
import { updateOwnProfile } from "@/services/auth/own-profile";
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
      passwordHash: true,
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
    const formData = await req.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
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

  const { name, phone, image, email } = await req
    .json()
    .catch(() => ({ name: undefined, phone: undefined, image: undefined, email: undefined }));

  // E-posta bu uctan hic yazilmaz; yine de goruntuleme oturumunda girisim acik 403 alir.
  if (email !== undefined) {
    const blocked = forbidWhileImpersonating(auth.user);
    if (blocked) return blocked;
  }

  // Telefon giris kimligi: yonetici goruntuleme oturumunda degistirilemez (ad/fotograf serbest).
  if (phone !== undefined) {
    const blocked = forbidWhileImpersonating(auth.user);
    if (blocked) return blocked;
  }

  /*
    Kurallar (ad siniri, telefon normalizasyonu ve giris-kilidi) web profil
    sayfasiyla ORTAK: `src/services/auth/own-profile.ts`. Telefon yalnizca
    `normalizeTrGsm10` biciminde saklanir; bosaltma (`""` / `null`) desteklenir.
  */
  try {
    const result = await updateOwnProfile({
      userId: auth.user.id,
      name,
      phone,
      // Yalnizca kaldirma: yeni fotograf multipart dalindan gelir.
      removeImage: image === null,
    });
    if (!result.ok) {
      const status = result.reason === "phone_taken" || result.reason === "phone_locked" ? 409 : 400;
      return NextResponse.json({ error: result.reason }, { status });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "mobile_profile_update_failed");
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

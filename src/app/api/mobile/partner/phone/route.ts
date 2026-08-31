import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { partnerProfileService } from "@/services/PartnerProfileService";
import { requireMobileUser, requireRole } from "@/lib/mobile-auth";

export async function PUT(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const roleErr = requireRole(auth.user, ["PARTNER"]);
  if (roleErr) return roleErr;

  const body = await req.json().catch(() => null);
  const phone = body && typeof body === "object" ? (body as { phone?: unknown }).phone : undefined;
  if (phone !== null && phone !== undefined && typeof phone !== "string") {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  /*
    GOVDE ARTIK SERVISTE (2026-09-01). Burasi ham degeri DOGRUDAN yaziyordu:
    normalizasyon yok, gecerlilik kontrolu yok, cakisma jenerik 500'e dusuyordu.

    En agir sonucu GIRIS: `User.phone` @unique ve `auth.config.ts` telefonla
    giriste iki bicim deniyor -- yazilanin aynisi ve 10 haneli normal bicim.
    Mobilden "0532 123 45 67" yazilmissa esnaf "05321234567" ile giris yapmaya
    calistiginda IKISI DE tutmaz; kendi numarasiyla hesabina giremez.

    Bos deger SILMEDIR: onceki `if (!phone)` kontrolu 400 donuyordu, yani numara
    bir kez girildikten sonra uygulamadan hic silinemiyordu.
  */
  const result = await partnerProfileService.updatePhone(auth.user.id, phone ?? null);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: result.reason === "already_registered" ? 409 : 400 },
    );
  }
  return NextResponse.json({ success: true, phone: result.phone });
}

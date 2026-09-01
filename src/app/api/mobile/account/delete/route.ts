import { NextRequest, NextResponse } from "next/server";
import { clientIpFromRequest } from "@/lib/client-ip";
import { accountPrivacyService } from "@/services/AccountPrivacyService";
import { requireMobileUser } from "@/lib/mobile-auth";

async function handleDeleteRequest(req: NextRequest) {
  const auth = await requireMobileUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  /*
    GOVDE `AccountPrivacyService`TE (2026-09-01). Ayni is web action'inda da
    yaziliydi -- rol kapisi, aktif rezervasyon kontrolu, alti silme,
    `user.update` ve denetim kaydi; `ACTIVE_BOOKING_STATUSES` listesi bile iki
    yerde tanimliydi. Iki kopya da `MobilePushToken`i atliyordu: modelde
    `onDelete: Cascade` var ama hesap SILINMIYOR, ANONIMLESTIRILIYOR -- yani
    cascade hic atesenmiyor ve cihaz token'lari geride kaliyordu.
  */
  const result = await accountPrivacyService.anonymizeSelf({
    userId: user.id,
    role: user.role,
    ip: clientIpFromRequest(req),
    auditAction: "account.anonymize_self_mobile",
  });
  if (!result.ok) {
    return result.reason === "not_guest"
      ? NextResponse.json({ error: "forbidden" }, { status: 403 })
      : NextResponse.json({ error: "Active bookings exist" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  return handleDeleteRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleDeleteRequest(req);
}

"use server";

import { getClientIpOrNull } from "@/lib/client-ip";

import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { accountPrivacyService } from "@/services/AccountPrivacyService";
import { requireUser } from "@/lib/action-auth";

/**
 * KVKK: misafir hesabını anonimleştirir (aktif rezervasyon yoksa).
 */
export async function anonymizeGuestAccountAction(): Promise<
  { success: true } | { success: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };
  /*
    Hesabi yalnizca MISAFIR kapatabilir: esnaf/admin hesabinin silinmesi
    dukkan ve denetim izini de etkiler, o yol admin panelindedir. Bu bir ROL
    KAPISI degil, ALAN kurali — kapidan gecmis aktor uzerinde uygulanir.
  */
  /*
    GOVDE `AccountPrivacyService`TE. Ayni is mobil ucta da yaziliydi -- rol
    kapisi, aktif rezervasyon kontrolu, alti silme, `user.update` ve denetim
    kaydi; `ACTIVE_BOOKING_STATUSES` listesi bile iki yerde tanimliydi. Iki
    kopya da `MobilePushToken`i atliyordu. Burada kalan tek is oturum cozumu,
    hata anahtari eslemesi ve `revalidate`.
  */
  const result = await accountPrivacyService.anonymizeSelf({
    userId: auth.actor.id,
    role: auth.actor.role,
    ip: await getClientIpOrNull(),
  });
  if (!result.ok) {
    return {
      success: false,
      error:
        result.reason === "not_guest"
          ? "Errors.unauthorized"
          : "Errors.accountDeleteActiveBookings",
    };
  }

  revalidatePathAllLocales("/");
  return { success: true };
}

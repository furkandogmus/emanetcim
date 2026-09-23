"use server";

import { getClientIp } from "@/lib/client-ip";

import { auth } from "@/auth";
import { referralService, type ReferralRejection } from "@/services/ReferralService";
import { requireUser } from "@/lib/action-auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Kullanıcının referans kodunu döndürür; yoksa oluşturur ve kaydeder.
 *
 * `error` alanı düz Türkçe metin değil `"Errors.x"` anahtarıdır — bu proje
 * çapında kurulu kalıp (bkz. `action-error.ts`, `dispute-error-copy.ts`);
 * ham Türkçe metin dönseydi DE/FR/FA/JA kullanıcısı hata mesajını hep
 * Türkçe görürdü. Çağıran taraf `useTranslations("Errors")` ile çevirir.
 */
export async function getOrCreateReferralCodeAction(): Promise<
  { success: true; code: string } | { success: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const code = await referralService.getOrCreateCode(auth.actor.id);
  if (code) return { success: true, code };
  return { success: false, error: "Errors.referralCodeFailed" };
}

/**
 * Referans kodu geçerliliğini kontrol eder (booking formunda önizleme için).
 * Kendi kodunu kullanamazsın.
 */
export async function validateReferralCodeAction(
  code: string,
  guestEmail?: string,
): Promise<{ valid: boolean; discountPct: number; reason?: ReferralRejection }> {
  if (typeof code !== "string" || !code.trim() || code.length > 32) {
    return { valid: false, discountPct: 0 };
  }

  /*
    HIZ SINIRI (2026-08-31'de eklendi). Bu action rezervasyon formundan
    KIMLIKSIZ cagrilabiliyor ve her cagrida bir veritabani sorgusu yapiyor. Kod
    uzayi kaba kuvvete kapali (sekiz karakter, 32 harfli alfabe) ama sinirsiz
    bir uc yine de bedava sorgu ureteci; mobil karsiligi da ayni sekilde
    sertlestirildi.

    `"use server"` ihraci Next.js'te canli bir HTTP ucudur: form uzerinden
    cagriliyor olmasi, yalnizca form uzerinden cagrilacagi anlamina gelmez.
  */
  const ip = await getClientIp();
  if (!(await rateLimit(`referral_validate:ip:${ip}`, 30, 10 * 60_000))) {
    return { valid: false, discountPct: 0 };
  }

  const session = await auth();
  const check = await referralService.check(code, {
    userId: session?.user?.id,
    guestEmail,
  });
  if (!check.ok) return { valid: false, discountPct: 0, reason: check.reason };
  return { valid: true, discountPct: check.discountPct };
}

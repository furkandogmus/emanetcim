"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { randomBytes } from "crypto";
import { requireUser } from "@/lib/action-auth";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // belirsiz karakterler çıkarıldı

function generateCode(length = 8): string {
  const bytes = randomBytes(length * 2);
  let result = "";
  for (let i = 0; i < bytes.length && result.length < length; i++) {
    const idx = bytes[i] % ALPHABET.length;
    result += ALPHABET[idx];
  }
  return result;
}

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

  const user = await prisma.user.findUnique({
    where: { id: auth.actor.id },
    select: { referralCode: true },
  });

  if (user?.referralCode) {
    return { success: true, code: user.referralCode };
  }

  // Benzersiz kod üret (çakışma döngüsü)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await prisma.user.update({
        where: { id: auth.actor.id },
        data: { referralCode: code },
      });
      return { success: true, code };
    } catch {
      // unique constraint ihlali — tekrar dene
    }
  }
  return { success: false, error: "Errors.referralCodeFailed" };
}

/**
 * Referans kodu geçerliliğini kontrol eder (booking formunda önizleme için).
 * Kendi kodunu kullanamazsın.
 */
export async function validateReferralCodeAction(
  code: string
): Promise<{ valid: boolean; discountPct: number }> {
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
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  if (!(await rateLimit(`referral_validate:ip:${ip}`, 30, 10 * 60_000))) {
    return { valid: false, discountPct: 0 };
  }

  const session = await auth();

  const owner = await prisma.user.findUnique({
    where: { referralCode: code.trim().toUpperCase() },
    select: { id: true },
  });

  if (!owner) return { valid: false, discountPct: 0 };
  // Kendi kodunu kullanamaz
  if (session?.user?.id && owner.id === session.user.id) {
    return { valid: false, discountPct: 0 };
  }

  const discountPct = Number(process.env.REFERRAL_DISCOUNT_PCT ?? "5");
  return { valid: true, discountPct };
}

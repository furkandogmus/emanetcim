"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { randomBytes } from "crypto";

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
 */
export async function getOrCreateReferralCodeAction(): Promise<
  { success: true; code: string } | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Giriş yapmanız gerekiyor." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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
        where: { id: session.user.id },
        data: { referralCode: code },
      });
      return { success: true, code };
    } catch {
      // unique constraint ihlali — tekrar dene
    }
  }
  return { success: false, error: "Kod oluşturulamadı, lütfen tekrar deneyin." };
}

/**
 * Referans kodu geçerliliğini kontrol eder (booking formunda önizleme için).
 * Kendi kodunu kullanamazsın.
 */
export async function validateReferralCodeAction(
  code: string
): Promise<{ valid: boolean; discountPct: number }> {
  if (!code?.trim()) return { valid: false, discountPct: 0 };

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

/**
 * Misafir referans indirimi — kural TEK yerde.
 *
 * NEDEN SERVIS (2026-09-23): kural uc yere dagilmisti ve hicbiri uctan uca
 * calismiyordu:
 *   - indirim hesabi `createBookingAction`in icindeydi (oran %0-50 arasina
 *     kirpiliyordu), onizleme `validateReferralCodeAction`da ayrica yazilmisti
 *     (kirpma YOK), mobil `/referrals/validate` ise orani hic dondurmuyordu;
 *   - web odeme ekrani da mobil odeme de `referralCode` gondermiyordu, davet
 *     linkindeki `?ref=` hicbir yerde okunmuyordu -- yani hesap sayfasindaki
 *     "%5 indirim kazandir" vaadi hicbir misafirde gerceklesmiyordu;
 *   - metin "ilk rezervasyonunda" diyordu, hesap her rezervasyonda indiriyordu;
 *   - mobil "her davet icin ₺20" diyordu; boyle bir odul hic yok.
 *
 * Kural: misafir (esnaf degil) bir kullanicinin kodu, kod sahibi kendisi
 * degilse, misafirin ILK rezervasyonunda, kupon kullanilmiyorsa, ara toplamdan
 * `REFERRAL_DISCOUNT_PCT` (varsayilan 5, %0-50 arasina kirpilir) indirir.
 */
import { randomInt } from "crypto";
import { BookingStatus, Role } from "@prisma/client";
import prisma from "@/lib/db";
import { applyReferralDiscount } from "@/lib/referral-discount";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // belirsiz karakterler çıkarıldı

// `randomInt` sapmasiz secer; `bayt % 32` 256'yi tam bolse de CodeQL onu
// (haklı olarak, genel durumda) sapmali sayar.
function generateCode(length = 8): string {
  let result = "";
  for (let i = 0; i < length; i++) result += ALPHABET[randomInt(ALPHABET.length)];
  return result;
}

export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Indirim orani (yuzde). Tek okuma noktasi: web, mobil ve onizleme ayni sayiyi gorur. */
export function getReferralDiscountPct(): number {
  const raw = Number(process.env.REFERRAL_DISCOUNT_PCT ?? "5");
  if (!Number.isFinite(raw)) return 0;
  return Math.min(50, Math.max(0, raw));
}

/** Misafirin kimligi: hesapli ise `userId`, hesapsiz web odemesinde e-posta. */
export type ReferralGuest = { userId?: string | null; guestEmail?: string | null };

export type ReferralRejection =
  | "invalid_code"
  | "own_code"
  | "not_first_booking";

export type ReferralCheck =
  | { ok: true; code: string; discountPct: number }
  | { ok: false; reason: ReferralRejection };

export type ReferralDiscount = { code: string; discountAmount: number; totalPrice: number };

/** Iptal edilmemis bir rezervasyonu varsa "ilk rezervasyon" degildir. */
async function hasPriorBooking(guest: ReferralGuest): Promise<boolean | null> {
  const notCancelled = { status: { not: BookingStatus.CANCELLED } };
  if (guest.userId) {
    return (await prisma.booking.count({ where: { guestId: guest.userId, ...notCancelled } })) > 0;
  }
  const email = guest.guestEmail?.trim().toLowerCase();
  if (email) {
    return (
      (await prisma.booking.count({
        where: { guestEmail: { equals: email, mode: "insensitive" }, ...notCancelled },
      })) > 0
    );
  }
  return null;
}

export class ReferralService {
  /**
   * Kod bu misafire indirim verir mi? Onizleme ve rezervasyon ayni cevabi
   * buradan alir. Misafir henuz bilinmiyorsa (hesapsiz, e-posta girilmemis)
   * ilk-rezervasyon kontrolu atlanir; rezervasyon aninda tekrar sorulur.
   */
  async check(rawCode: string, guest: ReferralGuest): Promise<ReferralCheck> {
    const code = normalizeReferralCode(rawCode);
    if (!code) return { ok: false, reason: "invalid_code" };

    const owner = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true, role: true },
    });
    // Esnaf kodu esnaf davetidir (`referredByPartnerId`), misafir indirimi degil.
    if (!owner || owner.role === Role.PARTNER) return { ok: false, reason: "invalid_code" };
    if (guest.userId && owner.id === guest.userId) return { ok: false, reason: "own_code" };

    if (await hasPriorBooking(guest)) return { ok: false, reason: "not_first_booking" };

    return { ok: true, code, discountPct: getReferralDiscountPct() };
  }

  /**
   * Rezervasyon aninda: indirimi hesaplar. Kod gecersizse ya da misafir
   * taninmiyorsa `null` -- rezervasyon tam fiyatla devam eder, hata vermez
   * (kupon ile ayni davranis).
   */
  async resolveDiscount(
    rawCode: string | undefined,
    guest: ReferralGuest,
    subtotal: number,
  ): Promise<ReferralDiscount | null> {
    if (!rawCode?.trim()) return null;
    if (!guest.userId && !guest.guestEmail?.trim()) return null;
    const check = await this.check(rawCode, guest);
    if (!check.ok || check.discountPct <= 0) return null;
    return { code: check.code, ...applyReferralDiscount(subtotal, check.discountPct) };
  }

  /** Kullanicinin paylasacagi kod; yoksa uretir. Esnaf da ayni alani kullanir. */
  async getOrCreateCode(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (user?.referralCode) return user.referralCode;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      try {
        await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
        return code;
      } catch {
        // unique constraint ihlali — tekrar dene
      }
    }
    return null;
  }
}

export const referralService = new ReferralService();

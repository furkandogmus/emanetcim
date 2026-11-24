"use server";

import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/action-auth";
import { qrSvg } from "@/lib/qr-svg";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { walkInBookingService, type WalkInResult, type WalkInSuccess } from "@/services/WalkInBookingService";

export type WalkInActionResult =
  | (WalkInSuccess & { qrSvg: string | null })
  | Exclude<WalkInResult, WalkInSuccess>
  | { ok: false; code: "AUTH"; error: string };

/**
 * Kapidan gelen misafir (web esnaf paneli). Yetki, hiz siniri ve kurallar serviste; mobil
 * `POST /api/mobile/partner/walk-in` ayni servisi cagirir. Onay e-postasinin dili panelin
 * dili: misafir tezgahta, operatorle ayni dilde konusuyor.
 */
export async function createWalkInBookingAction(input: unknown): Promise<WalkInActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, code: "AUTH", error: auth.error };
  const result = await walkInBookingService.create(auth.actor, input, { locale: await getLocale() });
  if (!result.ok) return result;
  revalidatePathAllLocales("/partner");
  revalidatePathAllLocales("/partner/bookings");
  // Iletisim verilmediyse misafir bu QR'in fotografini ceker; teslimde okutulur.
  return { ...result, qrSvg: result.qrCodeToken ? await qrSvg(result.qrCodeToken) : null };
}

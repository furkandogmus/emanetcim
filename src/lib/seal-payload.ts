import { z } from "zod";

/**
 * Check-in sırasında esnafın bildirdiği mühür bilgisi — TEK doğrulama noktası.
 *
 * Web (`checkInAction`) ve mobil (`/api/mobile/bookings/[id]/check-in`) aynı
 * şemayı kullanmak ZORUNDA: mobil uç eskiden istek gövdesini olduğu gibi
 * `BookingService.checkIn`'e geçiriyordu. `BookingSeal.bagSize` sütunu düz
 * `String` olduğu için veritabanı hiçbir şeyi engellemiyor — doğrulama yalnızca
 * burada var. `bagIndex` de sınırsızdı; `@@unique([bookingId, bagIndex])`
 * negatif ya da devasa indeksi memnuniyetle kabul eder ve check-out ekranı
 * valizi bir daha eşleştiremez.
 */
export const checkInSealsSchema = z.object({
  sealAssignments: z
    .array(
      z.object({
        sealNumber: z.number().int().positive().max(2_000_000_000),
        bagIndex: z.number().int().min(0).max(500),
        bagSize: z.enum(["S", "M", "XL"]),
      }),
    )
    .max(500),
  faultySealNumbers: z
    .array(z.number().int().positive().max(2_000_000_000))
    .max(500)
    .default([]),
});

export type CheckInSealsInput = z.infer<typeof checkInSealsSchema>;

/**
 * `undefined`/`null` → mühürsüz check-in (ayar kapalıyken meşru).
 * Geçersiz gövde → `null`, çağıran tarafın REDDETMESİ gerekir; sessizce
 * mühürsüz devam etmek esnafın girdiği numaraları sessizce çöpe atardı.
 */
export function parseCheckInSeals(
  input: unknown,
): { ok: true; value: CheckInSealsInput | undefined } | { ok: false } {
  if (input === undefined || input === null) return { ok: true, value: undefined };
  const parsed = checkInSealsSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  return { ok: true, value: parsed.data };
}

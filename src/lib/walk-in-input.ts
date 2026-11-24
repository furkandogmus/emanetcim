import { z } from "zod";

/** Kapidan gelen misafir govdesi: web action ve mobil `partner/walk-in` ortak (`WalkInBookingService`). */
export const walkInInputSchema = z
  .object({
    shopId: z.string().uuid(),
    guestName: z.string().trim().min(2).max(80),
    guestEmail: z
      .string()
      .trim()
      .max(254)
      .optional()
      .transform((v) => (v ? v.toLowerCase() : undefined))
      .pipe(z.string().email().optional()),
    guestPhone: z
      .string()
      .trim()
      .max(24)
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(z.string().regex(/^\+?[0-9 ()-]{7,24}$/).optional()),
    bagCount: z.number().int().min(1).max(50),
    pickupAt: z.string().datetime(),
    /** Operator, misafirin Kullanim Sartlari ve Aydinlatma Metni'ni kabul ettigini beyan eder. */
    termsConfirmed: z.literal(true),
  })
  .strict();

export type WalkInInput = z.input<typeof walkInInputSchema>;

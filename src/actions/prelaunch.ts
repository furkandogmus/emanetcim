"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";
import { analyticsService } from "@/services/AnalyticsService";
import logger from "@/lib/logger";

/**
 * Talep testi noktasi icin "acilinca haber ver" kaydi.
 *
 * GIRIS GEREKTIRMEZ: olculen sey tam da heniz musterimiz OLMAYAN kisilerin
 * ilgisidir. Kayit olmayi sart kosmak, olcmeye calistigimiz sinyalin buyuk
 * kismini eler.
 */

const schema = z.object({
  shopId: z.string().uuid(),
  email: z.string().email().max(200),
  sessionId: z.string().min(1).max(100).optional(),
});

export async function registerPrelaunchInterestAction(data: unknown) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Errors.invalidEmail" };
  }

  const locale = await getLocale();

  let result;
  try {
    result = await prelaunchInterestService.record({
      shopId: parsed.data.shopId,
      email: parsed.data.email,
      locale,
      source: "web",
    });
  } catch (err) {
    logger.error({ err }, "prelaunch_interest_action_failed");
    return { success: false as const, error: "Errors.generic" };
  }

  if (!result.ok) {
    /*
      `shop_not_prelaunch`: nokta bu arada hizmete acilmis demektir. Kullaniciya
      hata gostermek yanlis olur -- ona SEVINDIRICI haberi ve dogru eylemi
      soylemeliyiz: artik rezervasyon yapabilir.
    */
    return {
      success: false as const,
      error:
        result.code === "shop_not_prelaunch"
          ? "Errors.shopNowOpenBookInstead"
          : "Errors.generic",
    };
  }

  // Atesle-unut: analitik yazimi kullaniciyi bekletmemeli ve DUSURMEMELI.
  // Yakalanmamis bir red Node'da sureci indirir (mandal: unhandled-rejection).
  void Promise.resolve(
    analyticsService.track({
      name: "prelaunch_interest",
      sessionId: parsed.data.sessionId ?? "server",
      locale,
      metadata: { shopId: parsed.data.shopId },
    }),
  ).catch((err) => logger.warn({ err }, "prelaunch_interest_track_failed"));

  return { success: true as const, alreadyRegistered: result.alreadyRegistered };
}

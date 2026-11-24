"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { prelaunchInterestService } from "@/services/PrelaunchInterestService";
import { analyticsService } from "@/services/AnalyticsService";
import { ensureAnonVisitorId } from "@/lib/anon-visitor";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-ip";
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
  /** Bal kupu: formdaki gizli alan; yalnizca botlar doldurur. Adi bilerek anlamsiz (parola yoneticisi doldurmasin). */
  hp_field: z.string().max(200).optional(),
});

export async function registerPrelaunchInterestAction(data: unknown) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Errors.invalidEmail" };
  }
  // Bota basari gibi gorunur: hangi kontrolun yakaladigini ogrenmesin.
  if (parsed.data.hp_field) {
    logger.info({ shopId: parsed.data.shopId }, "prelaunch_interest_honeypot_hit");
    return { success: true as const, alreadyRegistered: false };
  }
  /*
    Girissiz ve her kayit bir teyit e-postasi atar: sinirsiz birakmak Resend
    hesabini kisitlatir ve parola sifirlama/rezervasyon e-postalari da durur.
    E-posta basina tavan serviste (mobil de ayni yoldan gecer).
  */
  const ip = await getClientIp();
  if (!(await rateLimit(`prelaunch_interest_ip:${ip}`, 5, 10 * 60_000))) {
    return { success: false as const, error: "Errors.tooManyRequests" };
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
          : result.code === "invalid_email"
            ? /*
                Adres bicimi bozuk. Bu action'in semasi zaten doguruyor, yani
                normalde erisilemez -- erisildiginde de "bir seyler ters gitti"
                yerine DUZELTILEBILIR olani soylemeli.
              */
              "Errors.invalidEmail"
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


const wantSchema = z.object({
  shopId: z.string().uuid(),
  sessionId: z.string().min(1).max(100).optional(),
});

/**
 * Talep testi noktasi icin TEK TIKLIK istek.
 *
 * E-POSTA ISTEMEZ. Olculmek istenen ilk soru ucuz olmali: "burada bir nokta
 * olsun mu?" E-posta bir adim otesidir ve o adimi soruyu sormanin ONUNE koymak,
 * cevaplarin buyuk kismini kaybettiriyordu.
 *
 * Dedupe sunucuda: `bp_anon` cerezindeki anonim kimlik + veritabani benzersizligi
 * (`@@unique([shopId, anonId])`). Istemciye birakilan bir "zaten tikladim"
 * isareti konsoldan silinebilirdi ve bu sayiya bakarak bir sehre esnaf
 * onboarding'i yapiliyor.
 */
export async function registerPrelaunchWantAction(data: unknown) {
  const parsed = wantSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Errors.generic" };
  }

  const locale = await getLocale();

  let anonId: string;
  try {
    anonId = await ensureAnonVisitorId();
  } catch (err) {
    logger.error({ err }, "prelaunch_want_action_failed");
    return { success: false as const, error: "Errors.generic" };
  }

  /*
    Cerez silinerek sayac sisirilebiliyordu: IP + nokta basina gunde bir sayim.
    Asan istek hata degil "zaten sayildi" gorur; ayni NAT'taki ikinci misafir
    kilitlenmez, yalniz sayaci ikinci kez artiramaz.
  */
  const ip = await getClientIp();
  if (!(await rateLimit(`prelaunch_want_ip:${ip}:${parsed.data.shopId}`, 1, 24 * 60 * 60_000))) {
    const count = await prelaunchInterestService.wantCount(parsed.data.shopId).catch(() => 0);
    return { success: true as const, alreadyCounted: true, count };
  }

  // Govde serviste (`registerWant`): mobil `prelaunch/want` ucu da onu cagirir.
  const result = await prelaunchInterestService.registerWant({
    shopId: parsed.data.shopId,
    anonId,
    locale,
    source: "web",
    sessionId: parsed.data.sessionId,
  });
  if (!result.ok) {
    // Nokta bu arada acilmis olabilir; dogru eylem artik rezervasyon yapmak.
    return {
      success: false as const,
      error: result.code === "shop_not_prelaunch" ? "Errors.shopNowOpenBookInstead" : "Errors.generic",
    };
  }

  return {
    success: true as const,
    alreadyCounted: result.alreadyCounted,
    count: result.count,
  };
}

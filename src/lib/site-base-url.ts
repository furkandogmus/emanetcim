import logger from "@/lib/logger";

/**
 * SITENIN KAMU KOK ADRESI — tek yer.
 *
 * NEDEN VAR (2026-08-31'de olculdu): ayni kavram on yerde ayri ayri
 * cozuluyordu ve DORT FARKLI yedek degeri vardi:
 *
 *   `site-urls.ts`          BASE || APP || "http://localhost:3000"
 *   `config.ts`             BASE || "http://localhost:3000"        (APP'i yok sayar)
 *   `mail.ts`               APP  || "http://localhost:3000"        (BASE'i yok sayar)
 *   `NotificationService`   APP  || "https://bagajpark.com"        (x6, BASE'i yok sayar)
 *   `ShopService`           APP  || "https://bagajpark.com"
 *
 * Iki somut ariza uretiyordu:
 *
 * 1. **Sifre sifirlama ve dogrulama e-postalari `localhost` isaret edebiliyordu.**
 *    `NEXT_PUBLIC_BASE_URL` tanimli ve `NEXT_PUBLIC_APP_URL` tanimsizsa
 *    (`docker-compose.env.example` tam olarak bu ayrimi oneriyor -- BASE'i
 *    "sitemap/canonical temeli" diye yazip APP'i `http://localhost` birakiyor),
 *    canonical ve sitemap dogru cikiyor ama `mail.ts` `localhost`a dusuyordu.
 *    Kullanici parolasini SIFIRLAYAMAZ hale gelir ve bunun sebebini goremez.
 *    Ayni hata bir tur once `partner-password-reset.ts`te bulunmustu; kokU bu.
 *
 * 2. **Yedek deger olarak prod alan adi sabitlenmisti** (yedi yerde). Bir
 *    hazirlik/deneme ortaminda degisken tanimsiz kalirsa, test kullanicilarina
 *    sessizce URETIM baglantilari giden e-postalar cikiyordu.
 *
 * BAGIMLILIGI YOK (`logger` disinda): e-posta sablonlari ve servisler bunu
 * ithal ediyor; `site-urls.ts` i18n `routing`ini cekiyor ve onu o katmanlara
 * tasimak gereksiz.
 */

const LOCAL_FALLBACK = "http://localhost:3000";

let warnedAboutFallback = false;

export function getSiteBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (raw) return raw.replace(/\/$/, "");

  /*
    URETIMDE SESSIZ DUSMEK YASAK. Bu yedege dusmek, gonderilen her e-postanin
    `localhost` isaret etmesi demek -- yani sifre sifirlama akisinin tamamen
    calismamasi. Onceki hallerin hicbiri bunu hicbir yere yazmiyordu, yani
    ariza ancak "sifremi sifirlayamiyorum" diyen bir kullanici uzerinden
    gorulebiliyordu.
  */
  if (process.env.NODE_ENV === "production" && !warnedAboutFallback) {
    warnedAboutFallback = true;
    logger.error(
      { fallback: LOCAL_FALLBACK },
      "site_base_url_missing_emails_will_point_to_localhost",
    );
  }
  return LOCAL_FALLBACK;
}

/** `/api/health` icin: kok adres gercekten yapilandirilmis mi? */
export function isSiteBaseUrlConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  );
}

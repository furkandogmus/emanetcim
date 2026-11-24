/**
 * Mobil uygulama magazalari — TEK YER (veritabanisiz kisim; istemci de import eder).
 *
 * Adresler, rozetler ve "hangi magaza yayinda" bilgisi burada durur; web ana
 * sayfa, altbilgi, Safari akilli bandi, onay e-postasi ve `/app` yonlendirmesi
 * hepsi buradan okur. Bayraklar `PlatformSettings.iosAppStoreLive` /
 * `androidPlayLive` (yonetici platform ayarlari); ikisi de kapaliyken site
 * bugunku haliyle kalir.
 */

export const IOS_APP_STORE_ID = "6838203193";
/** Yalnizca Turkiye magazasinda yayinda; `tr` vitrini bilerek sabit. */
export const IOS_APP_STORE_URL = `https://apps.apple.com/tr/app/id${IOS_APP_STORE_ID}`;
export const ANDROID_PACKAGE = "com.bagajpark";
export const ANDROID_PLAY_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/**
 * Basili malzemenin (afis, QR) gosterdigi adres. URETIM ALAN ADI BILEREK SABIT:
 * kagida basilan bir QR hazirlik ortamina degil, gercek siteye gitmeli.
 */
export const APP_DOWNLOAD_URL = "https://bagajpark.com/app";

/**
 * Resmi rozetler (`public/badges/`), RENK/BICIM DEGISTIRILMEDEN kullanilir.
 * - App Store: https://tools.applemediaservices.com/app-store-badges
 *   (download-on-the-app-store/black/tr-tr). PNG, e-posta icin ayni SVG'den
 *   olceklenerek uretildi: Gmail SVG gostermiyor.
 * - Google Play: https://play.google.com/intl/en_us/badges/ (tr_badge_web_generic.png).
 *   Google rozeti kendi bos alanini (clear space) gorselin icinde tasir; bu
 *   yuzden ayni gorunur yukseklik icin App Store rozetinden ~1.5 kat yuksek cizilir.
 */
export const APP_STORE_BADGE = {
  svg: "/badges/app-store-tr.svg",
  png: "/badges/app-store-tr.png",
  /** Viewbox orani 151.29 x 40. */
  ratio: 151.29018 / 40,
} as const;
export const GOOGLE_PLAY_BADGE = {
  png: "/badges/google-play-tr.png",
  /** 646 x 250, ic bosluk dahil. */
  ratio: 646 / 250,
} as const;

export type AppStoreFlags = { iosAppStoreLive: boolean; androidPlayLive: boolean };

export const APP_STORES_OFF: AppStoreFlags = { iosAppStoreLive: false, androidPlayLive: false };

export function anyStoreLive(f: AppStoreFlags): boolean {
  return f.iosAppStoreLive || f.androidPlayLive;
}

export type AppPlatform = "ios" | "android" | "other";

/**
 * Kaba platform tespiti. iPadOS 13+ masaustu Safari UA'si gonderir
 * ("Macintosh"); onu ayirt edemeyiz ve `other` sayariz — acilis sayfasi
 * iki rozeti de gosterdigi icin kullanici yine magazaya ulasir.
 */
export function detectAppPlatform(userAgent: string | null | undefined): AppPlatform {
  const ua = userAgent ?? "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
}

/** Arama motoru / onizleme botu: isabet olarak SAYILMAZ (yonlendirme yine calisir). */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = userAgent ?? "";
  if (ua.trim() === "") return true;
  // Ciplak `bot` YOK: "CUBOT" marka Android telefonlari da eslesir ve gercek ziyaretci dusurulurdu.
  return /\bbot\b|bot\/|adsbot|slackbot|duckduckbot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|headless/i.test(
    ua,
  );
}

/** Bilinen kampanya kaynaklari; disindaki serbest etiketler `other` kovasina duser. */
const SOURCE_ALLOWLIST = new Set([
  "instagram",
  "facebook",
  "tiktok",
  "google",
  "whatsapp",
  "qr",
  "airbnb",
  "direct",
]);
// `afis-` kimligi UUID (tireli): eski kalip tireyi reddediyor, her afis isabeti `other`a dusuyordu.
const SOURCE_SHAPES = [/^web-[a-z0-9-]{1,24}$/, /^email-[a-z0-9-]{1,24}$/, /^afis-[a-z0-9-]{8,40}$/];

/**
 * Kaynak etiketini normallestirir. Defter yalnizca BILINEN bicimleri tutar:
 * `web-*`, `email-*`, `afis-<dukkanId>` ve kisa bir kampanya listesi; gerisi
 * `other`. Boylece rastgele `?kaynak=` ile tablo sisirilemez ve etikete
 * kisisel veri gomulemez. `kaynak` once, yoksa `utm_source`; ikisi de bossa `direct`.
 */
export function normalizeAppLinkSource(kaynak: string | null, utmSource: string | null): string {
  for (const raw of [kaynak, utmSource]) {
    const clean = (raw ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!clean) continue;
    if (SOURCE_ALLOWLIST.has(clean) || SOURCE_SHAPES.some((re) => re.test(clean))) return clean;
    return "other";
  }
  return "direct";
}

export type AppLinkDecision =
  | { outcome: "redirect"; url: string }
  | { outcome: "landing" };

/** `/app` karari: platformun magazasi yayindaysa oraya, degilse acilis sayfasina. */
export function decideAppLink(platform: AppPlatform, flags: AppStoreFlags): AppLinkDecision {
  if (platform === "ios" && flags.iosAppStoreLive) return { outcome: "redirect", url: IOS_APP_STORE_URL };
  if (platform === "android" && flags.androidPlayLive) return { outcome: "redirect", url: ANDROID_PLAY_URL };
  return { outcome: "landing" };
}

/** Kaynak etiketli `/app` bagi (kok adres verilmezse uretim adresi). */
export function appLinkHref(source: string, base?: string): string {
  const root = base ? `${base.replace(/\/$/, "")}/app` : APP_DOWNLOAD_URL;
  return `${root}?kaynak=${encodeURIComponent(source)}`;
}

/**
 * Safari akilli bandi (`<meta name="apple-itunes-app">`). Yalnizca iOS yayindayken.
 * `appArgument` uygulamaya acilacak bagi iletir (`+native-intent.tsx` `/<dil>/shop/<id>` tanir).
 */
export function smartAppBannerMetadata(
  flags: AppStoreFlags,
  appArgument?: string,
): { itunes?: { appId: string; appArgument?: string } } {
  if (!flags.iosAppStoreLive) return {};
  return { itunes: appArgument ? { appId: IOS_APP_STORE_ID, appArgument } : { appId: IOS_APP_STORE_ID } };
}

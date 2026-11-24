/**
 * Uygulama baglantilari (iOS Universal Links, Android App Links): dukkan, hesapli misafirin
 * ve esnafin rezervasyonu, araci paneli ve davetli kayit telefonda uygulamayi acar. Mobil
 * taraf yollari `mobile-expo/src/lib/app-link-path.ts` icinde uygulama ekranlarina cevirir.
 * Hesapsiz misafirin baglantisi (`/bookings/manage/<jeton>`, `/bookings/lookup`) ve
 * `/auth/*` (sifre sifirlama, e-posta dogrulama jetonu) tarayicida kalir: uygulama
 * jetonla giris yapmaz, sifreyi e-postadaki KODLA sifirlar.
 *
 * Kimlikler gizli degil ama ortama bagli; tanimli degilse dosya 404 doner -- yanlis bir
 * parmak izi yayinlamaktansa dogrulamanin hic yapilmamasi daha iyi (baglanti tarayicida acilir).
 *  - ANDROID_APP_LINK_SHA256: Play Console > Uygulama imzalama > SHA-256 (virgulle birden fazla).
 *  - APPLE_TEAM_ID: Apple Developer hesabinin Team ID'si.
 */
export const APP_ID = "com.bagajpark";
export const APP_LINK_PATHS = [
  "/*/shop/*",
  "/*/bookings/*",
  "/*/partner/bookings/*",
  "/*/account/affiliate",
  "/*/register",
];

type AasaComponent = { "/": string; "?"?: Record<string, string>; exclude?: true };

/*
  AASA'da ilk eslesen kural kazanir ve `*` egik cizgiyi de yutar: dislamalar dahil
  edilen yollardan ONCE gelir. Esnaf daveti (`?role=PARTNER&ref=`) webde kalir;
  esnaf basvurusu uygulamada yok, davet kodu web formuna dolar.
*/
export const APP_LINK_EXCLUDES: AasaComponent[] = [
  { "/": "/*/admin/*", exclude: true },
  { "/": "/*/auth/*", exclude: true },
  { "/": "/*/bookings/lookup*", exclude: true },
  { "/": "/*/bookings/manage/*", exclude: true },
  { "/": "/*/bookings/*/*", exclude: true },
  { "/": "/*/register", "?": { role: "?*" }, exclude: true },
  { "/": "/*/register", "?": { partnerref: "?*" }, exclude: true },
];

export function appLinkComponents(): AasaComponent[] {
  return [...APP_LINK_EXCLUDES, ...APP_LINK_PATHS.map((p) => ({ "/": p }))];
}

export function androidFingerprints(env = process.env): string[] {
  return (env.ANDROID_APP_LINK_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
}

export function assetLinks(env = process.env) {
  const fingerprints = androidFingerprints(env);
  if (fingerprints.length === 0) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: APP_ID, sha256_cert_fingerprints: fingerprints },
    },
  ];
}

export function appleAppSiteAssociation(env = process.env) {
  const team = env.APPLE_TEAM_ID?.trim();
  if (!team || !/^[A-Z0-9]{10}$/.test(team)) return null;
  return {
    applinks: {
      details: [{ appIDs: [`${team}.${APP_ID}`], components: appLinkComponents() }],
    },
  };
}

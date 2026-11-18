/**
 * Uygulama baglantilari: https://bagajpark.com/<dil>/shop/<id> telefonda uygulamayi acar
 * (rezervasyon baglantilari BILEREK yok: e-postayla hesabi olmayan misafire de gidiyor,
 * uygulamada girissiz acilamaz) (Android App Links, iOS Universal Links). Mobil taraf yollari
 * `mobile-expo/src/app/+native-intent.tsx` icinde uygulama ekranlarina cevirir.
 *
 * Kimlikler gizli degil ama ortama bagli; tanimli degilse dosya 404 doner -- yanlis bir
 * parmak izi yayinlamaktansa dogrulamanin hic yapilmamasi daha iyi (baglanti tarayicida acilir).
 *  - ANDROID_APP_LINK_SHA256: Play Console > Uygulama imzalama > SHA-256 (virgulle birden fazla).
 *  - APPLE_TEAM_ID: Apple Developer hesabinin Team ID'si.
 */
export const APP_ID = "com.bagajpark";
export const APP_LINK_PATHS = ["/*/shop/*"];

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
      details: [{ appIDs: [`${team}.${APP_ID}`], components: APP_LINK_PATHS.map((p) => ({ "/": p })) }],
    },
  };
}

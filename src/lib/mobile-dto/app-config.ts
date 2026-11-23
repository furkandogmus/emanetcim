type AppConfigSource = {
  minAppVersion: string | null;
  latestAppVersion: string | null;
  /** Yonetici ayari: check-in'de muhur numarasi zorunlu mu. Gizli degil. */
  requireSealsOnCheckIn?: boolean;
  /** Odeme metinlerinin kipi: "onsite" dukkanda tahsilat, "online" kartli. Bilinmiyorsa "onsite". */
  paymentMode?: "online" | "onsite";
};

/**
 * Uzaktan yapilandirma: degerlendirilmis { anahtar: acik/kapali } haritasi.
 * `/api/mobile/feature-flags`'in tek yaziciysi.
 */
export function toMobileFeatureFlags(flags: Record<string, boolean>) {
  return { flags };
}

/**
 * Uygulama acilis kontrolu: zorunlu/opsiyonel guncelleme kapisi.
 * `/api/mobile/config`'in tek yaziciysi.
 */
export function toMobileAppConfig(c: AppConfigSource) {
  return {
    minAppVersion: c.minAppVersion,
    latestAppVersion: c.latestAppVersion,
    requireSealsOnCheckIn: c.requireSealsOnCheckIn === true,
    // Gercek olan varsayilandir: bilinmeyen kip kartli odeme vaat etmez.
    paymentMode: c.paymentMode === "online" ? ("online" as const) : ("onsite" as const),
  };
}

type MobileDeviceSource = {
  token: string;
  platform: string;
  appVersion: string | null;
  locale: string | null;
  lastSeenAt: Date;
};

/**
 * "Bildirim alan cihazlar" ekranının gövdesi. `token` alanı yalnızca geri
 * kaldırma çağrısı (`DELETE /api/mobile/push/register`) için taşınır;
 * EKRANDA `tokenSuffix` (son 6 karakter) gösterilir, ham token'ın tamamı
 * kullanıcıya BASILMAZ — kendi hesabına ait veri olsa da uzun opak bir
 * push token'ı ekranda göstermenin kullanıcıya hiçbir faydası yok.
 */
export function toMobileDevice(d: MobileDeviceSource) {
  return {
    token: d.token,
    tokenSuffix: d.token.slice(-6),
    platform: d.platform,
    appVersion: d.appVersion,
    locale: d.locale,
    lastSeenAt: d.lastSeenAt,
  };
}

import * as Location from "expo-location";

export type DevicePosition = { latitude: number; longitude: number };
export type LocationFailure = "denied" | "unavailable";

/** Kapali alanda GPS hic cevap vermeyebiliyor; zaman asimsiz cagri "Konum aliniyor"da kaliyordu. */
const TIMEOUT_MS = 10_000;
/** Son bilinen konum bu kadar yeniyse yeterli: yeni olcum beklenmez. */
const MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Izin + konum. Hata FIRLATMAZ: ekran "izin yok" ile "konum alinamadi"yi ayri soyler
 * (izin verildigi halde "izin reddedildi" yaziyordu, 2026-11-19 emulatorde goruldu).
 */
export async function getDevicePosition(): Promise<
  | { ok: true; position: DevicePosition }
  | { ok: false; reason: LocationFailure; /** false: izin kalici reddedildi, sistem penceresi bir daha acilmaz. */ canAskAgain: boolean }
> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { ok: false, reason: "denied", canAskAgain: perm.canAskAgain };

    const last = await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS });
    const pos =
      last ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
      ]));
    if (!pos) return { ok: false, reason: "unavailable", canAskAgain: true };
    return { ok: true, position: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } };
  } catch {
    return { ok: false, reason: "unavailable", canAskAgain: true };
  }
}

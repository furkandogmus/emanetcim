/**
 * API adresi derleme aninda `EXPO_PUBLIC_API_BASE_URL` ile verilir.
 *
 * Varsayilan BILEREK yerel emulator adresi (Android emulatorunde 10.0.2.2 =
 * gelistirici makinesinin localhost'u). Uretim adresine sessizce baglanan bir
 * gelistirme derlemesi, gercek esnaflara test rezervasyonu dusurur.
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:3000/api/mobile"
).replace(/\/$/, "");

/**
 * Fiziksel mühür henüz dağıtılmadı: esnaf teslim alırken mühür numarası sorulmaz,
 * mühür menüsü gizlenir. Sunucu mühürsüz check-in'i zaten kabul eder
 * (`requireSealsOnCheckIn` false); onu açmadan önce bunu true yapıp OTA gönder.
 */
export const SEALS_ENABLED = false;

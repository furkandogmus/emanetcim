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

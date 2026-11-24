/**
 * Calisan sunucu surumu: imaj `APP_VERSION` ile gelir (compose). Log satirlari ve
 * yonetici "Sistem" ekrani ayni degeri okur; ikisi ayrisirsa hangi imajin
 * calistigi sorusu iki cevap alir.
 */
export const SERVER_VERSION: string =
  process.env.APP_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
  process.env.npm_package_version ||
  "dev";

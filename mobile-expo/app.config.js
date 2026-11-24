// app.json'u temel alir; yalnizca repoya girmeyen dosya yollarini ve derleme ortamina bagli
// eklentileri ekler.
// google-services.json (Firebase, FCM): yerelde kokte durur (gitignore'da),
// EAS'ta `GOOGLE_SERVICES_JSON` dosya tipli ortam degiskeniyle gelir.
// Sentry kaynak haritasi yuklemesi yalniz SENTRY_AUTH_TOKEN varken kurulur: eklenti
// derlemeye yukleme adimi ekler ve jetonsuz derlemede o adim derlemeyi kirar. Org/proje
// SENTRY_ORG / SENTRY_PROJECT ortam degiskenlerinden okunur; repoda deger yok.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
  plugins: [...(config.plugins ?? []), ...(process.env.SENTRY_AUTH_TOKEN ? ["@sentry/react-native/expo"] : [])],
  extra: {
    ...config.extra,
    ...(process.env.EXPO_PUBLIC_SENTRY_DSN ? { sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN } : {}),
  },
});

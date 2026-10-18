// app.json'u temel alir; yalnizca repoya girmeyen dosya yollarini ekler.
// google-services.json (Firebase, FCM): yerelde kokte durur (gitignore'da),
// EAS'ta `GOOGLE_SERVICES_JSON` dosya tipli ortam degiskeniyle gelir.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
});

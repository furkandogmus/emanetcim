// Uygulama yalnizca dikey (app.json orientation). Play bunu
// android.hardware.screen.portrait ZORUNLU ozelligi sayip yatay ekranli cihazlari
// (masaustu, XR, bazi tabletler) disarida birakiyordu; Play Console 0.3.0'da uyardi
// (2026-11-19). Ozellik istege bagli bildirilir; ekran yonu yine dikey kilitli kalir.
const { withAndroidManifest } = require("expo/config-plugins");

const FEATURE = "android.hardware.screen.portrait";

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$["xmlns:tools"] = manifest.$["xmlns:tools"] ?? "http://schemas.android.com/tools";
    const features = (manifest["uses-feature"] = manifest["uses-feature"] ?? []);
    const existing = features.find((f) => f.$?.["android:name"] === FEATURE);
    if (existing) {
      existing.$["android:required"] = "false";
    } else {
      features.push({ $: { "android:name": FEATURE, "android:required": "false" } });
    }
    return cfg;
  });
};

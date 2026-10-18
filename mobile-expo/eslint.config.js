// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // android/ ve ios/ CNG ciktisi; elle yazilmaz, lint edilmez.
    ignores: ["dist/*", "android/*", "ios/*", ".expo/*"],
  },
]);

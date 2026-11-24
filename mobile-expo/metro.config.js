// Sentry: paketlere debug id gomer; OTA kaynak haritalari surum eslesmesine gerek kalmadan baglanir.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);

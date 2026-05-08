class Env {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://bagajpark.com/api/mobile',
  );

  static const String stripePublishableKey = String.fromEnvironment(
    'STRIPE_PK',
  );

  static const String sentryDsn = String.fromEnvironment('SENTRY_DSN');

  static const bool firebaseEnabled = bool.fromEnvironment('FIREBASE_ENABLED');

  static const String mapTileUrl = String.fromEnvironment(
    'MAP_TILE_URL',
    defaultValue:
        'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  );
}

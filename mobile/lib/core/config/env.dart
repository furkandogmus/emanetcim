class Env {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://bagajpark.com/api/mobile',
  );

  static const bool firebaseEnabled = bool.fromEnvironment('FIREBASE_ENABLED', defaultValue: true);

  static const String googleWebClientId = String.fromEnvironment(
    'GOOGLE_WEB_CLIENT_ID',
    defaultValue: '1034885764385-c5f4o8bo3ttdg193en2m5fabj8rja90l.apps.googleusercontent.com',
  );

  static const String mapTileUrl = String.fromEnvironment(
    'MAP_TILE_URL',
    defaultValue:
        'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  );
}

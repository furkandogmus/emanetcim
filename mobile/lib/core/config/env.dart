class Env {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://bagajpark.com/api/mobile',
  );

  static const bool firebaseEnabled = bool.fromEnvironment(
    'FIREBASE_ENABLED',
    defaultValue: true,
  );

  /// Ekran turu (integration_test) icin: esnaf rolunde acilan FLAG_SECURE ekran goruntusunu
  /// engeller; yalnizca --dart-define=E2E_CAPTURE=true ile kapatilir, varsayilan koruma acik.
  static const bool e2eCapture = bool.fromEnvironment('E2E_CAPTURE');

  static const String googleWebClientId = String.fromEnvironment(
    'GOOGLE_WEB_CLIENT_ID',
    defaultValue:
        '1034885764385-c5f4o8bo3ttdg193en2m5fabj8rja90l.apps.googleusercontent.com',
  );
}

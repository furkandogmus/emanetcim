import 'package:flutter/foundation.dart';

/// A production-ready logger that can be extended to send logs to
/// remote services like Sentry or Datadog.
class Logger {
  static void d(String message) {
    if (kDebugMode) {
      debugPrint('💙 [DEBUG] $message');
    }
  }

  static void i(String message) {
    debugPrint('💚 [INFO] $message');
  }

  static void w(String message, [dynamic error, StackTrace? stack]) {
    debugPrint('💛 [WARN] $message');
    if (error != null) debugPrint('   Error: $error');
  }

  static void e(String message, [dynamic error, StackTrace? stack]) {
    debugPrint('❤️ [ERROR] $message');
    if (error != null) {
      debugPrint('   Error: $error');
      // Here you would send to Sentry:
      // Sentry.captureException(error, stackTrace: stack);
    }
  }
}

import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

/// A production-ready logger with Sentry integration.
class Logger {
  static void d(String message) {
    if (kDebugMode) {
      debugPrint('💙 [DEBUG] $message');
    }
  }

  static void i(String message) {
    debugPrint('💚 [INFO] $message');
    Sentry.addBreadcrumb(Breadcrumb(message: message, level: SentryLevel.info));
  }

  static void w(String message, [dynamic error, StackTrace? stack]) {
    debugPrint('💛 [WARN] $message');
    if (error != null) debugPrint('   Error: $error');
    Sentry.addBreadcrumb(
      Breadcrumb(
        message: message,
        level: SentryLevel.warning,
        data: error != null ? {'error': error.toString()} : null,
      ),
    );
  }

  static void e(String message, [dynamic error, StackTrace? stack]) {
    debugPrint('❤️ [ERROR] $message');
    if (error != null) {
      debugPrint('   Error: $error');
      Sentry.captureException(error, stackTrace: stack);
    } else {
      Sentry.captureMessage(message, level: SentryLevel.error);
    }
  }
}

import 'package:flutter/foundation.dart';

/// Application logger.
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
    if (stack != null) debugPrintStack(stackTrace: stack);
  }

  static void e(String message, [dynamic error, StackTrace? stack]) {
    debugPrint('❤️ [ERROR] $message');
    if (error != null) {
      debugPrint('   Error: $error');
      if (stack != null) debugPrintStack(stackTrace: stack);
    }
  }
}

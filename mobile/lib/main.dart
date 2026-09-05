import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_jailbreak_detection/flutter_jailbreak_detection.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

import 'app/app.dart';
import 'core/auth/token_store.dart';
import 'core/config/env.dart';
import 'core/services/logger_service.dart';
import 'features/security/root_warning_screen.dart';
import 'shared/widgets/global_error_widget.dart';

@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  // Background push handler — silent. Foreground aktivitesi push_service.dart'ta.
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();
  await Hive.initFlutter();

  // Global Error Handling
  ErrorWidget.builder = (details) => GlobalErrorWidget(details: details);

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    Logger.e(
      'Flutter Error: ${details.exception}',
      details.exception,
      details.stack,
    );
  };

  WidgetsBinding.instance.platformDispatcher.onError = (error, stack) {
    Logger.e('Async Error: $error', error, stack);
    return true;
  };

  // Encryption for Hive (Security Hardening)
  final tokenStore = TokenStore();
  List<int>? hiveKey;
  try {
    hiveKey = await tokenStore.getHiveKey();
  } catch (e) {
    Logger.e('Hive Key error', e);
  }

  if (hiveKey != null) {
    final cipher = HiveAesCipher(hiveKey);
    await Hive.openBox('pending_sync_actions', encryptionCipher: cipher);
    await Hive.openBox('partner_bookings_cache', encryptionCipher: cipher);
    await Hive.openBox('my_bookings_cache', encryptionCipher: cipher);
  } else {
    Logger.e(
      'Hive encryption key unavailable; caching disabled. Data will not persist across restarts.',
    );
  }

  var isRooted = false;
  try {
    isRooted = await FlutterJailbreakDetection.jailbroken;
  } catch (e) {
    Logger.w('Security check error', e);
  }

  if (Env.firebaseEnabled) {
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
    } catch (e) {
      Logger.e('Firebase init failed', e);
    }
  }

  final app = EasyLocalization(
    supportedLocales: const [Locale('tr'), Locale('en')],
    path: 'assets/l10n',
    fallbackLocale: const Locale('tr'),
    child: const ProviderScope(child: BagajParkApp()),
  );

  runApp(isRooted ? RootWarningScreen(onContinue: () => runApp(app)) : app);
}

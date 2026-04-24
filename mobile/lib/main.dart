import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'app/app.dart';
import 'core/config/env.dart';
import 'core/auth/token_store.dart';
import 'features/security/root_warning_screen.dart';
import 'shared/widgets/global_error_widget.dart';
import 'package:flutter_jailbreak_detection/flutter_jailbreak_detection.dart';

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

  // Encryption for Hive (Security Hardening)
  final tokenStore = TokenStore();
  List<int>? hiveKey;
  try {
    hiveKey = await tokenStore.getHiveKey();
  } catch (e) {
    debugPrint('Hive Key error: $e');
  }

  if (hiveKey != null) {
    final cipher = HiveAesCipher(hiveKey);
    await Hive.openBox('pending_sync_actions', encryptionCipher: cipher);
    await Hive.openBox('partner_bookings_cache', encryptionCipher: cipher);
    await Hive.openBox('my_bookings_cache', encryptionCipher: cipher);
  } else {
    // Fallback if secure storage fails completely (e.g. some emulators)
    await Hive.openBox('pending_sync_actions');
    await Hive.openBox('partner_bookings_cache');
    await Hive.openBox('my_bookings_cache');
  }

  bool isRooted = false;
  try {
    isRooted = await FlutterJailbreakDetection.jailbroken;
  } catch (e) {
    debugPrint('Security check error: $e');
  }

  if (Env.firebaseEnabled) {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
  }

  final app = EasyLocalization(
    supportedLocales: const [Locale('tr'), Locale('en')],
    path: 'assets/l10n',
    fallbackLocale: const Locale('tr'),
    child: const ProviderScope(child: BagajParkApp()),
  );

  await SentryFlutter.init(
    (options) {
      options.dsn = Env.sentryDsn;
      options.tracesSampleRate = 0.2;
    },
    appRunner: () => runApp(
      isRooted ? RootWarningScreen(onContinue: () => runApp(app)) : app,
    ),
  );
}

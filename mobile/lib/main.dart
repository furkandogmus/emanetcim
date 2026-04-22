import 'dart:io' show Platform;
import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import 'app/app.dart';
import 'core/config/env.dart';
import 'core/auth/token_store.dart';
import 'package:flutter_jailbreak_detection/flutter_jailbreak_detection.dart';

@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  // Background push handler — silent. Foreground aktivitesi push_service.dart'ta.
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();
  await Hive.initFlutter();

  // Encryption for Hive (Security Hardening)
  final tokenStore = TokenStore();
  final hiveKey = await tokenStore.getHiveKey();
  await Hive.openBox(
    'pending_sync_actions',
    encryptionCipher: HiveAesCipher(hiveKey!),
  );

  try {
    final isRooted = await FlutterJailbreakDetection.jailbroken;
    // logger.i('App initialized');
    if (isRooted) {
      debugPrint('WARNING: Device is jailbroken/rooted!');
    }
  } catch (e) {
    debugPrint('Security check error: $e');
  }

  if (Env.firebaseEnabled) {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
  }

  // Stripe macOS'ta desteklenmediği için hata fırlatıyor, try-catch ile korumaya alıyoruz.
  try {
    Stripe.publishableKey = Env.stripePublishableKey;
    if (Platform.isIOS || Platform.isAndroid) {
      await Stripe.instance.applySettings();
    }
  } catch (e) {
    debugPrint('Stripe init error: $e');
  }

  await SentryFlutter.init(
    (options) {
      options.dsn = Env.sentryDsn;
      options.tracesSampleRate = 0.2;
    },
    appRunner: () => runApp(
      EasyLocalization(
        supportedLocales: const [Locale('tr'), Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('tr'),
        child: const ProviderScope(child: BagajParkApp()),
      ),
    ),
  );
}

import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';
import 'package:jailbreak_root_detection/jailbreak_root_detection.dart';

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

  // EasyLocalization ve Hive motoru init'i birbirine bagimli degil; paralel calistir.
  await Future.wait([EasyLocalization.ensureInitialized(), Hive.initFlutter()]);

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

  // Encryption for Hive (Security Hardening) — Hive.initFlutter() bitmis olmali,
  // box'lar bu anahtara bagimli oldugu icin sirali kalir.
  final tokenStore = TokenStore();
  List<int>? hiveKey;
  try {
    hiveKey = await tokenStore.getHiveKey();
  } catch (e) {
    Logger.e('Hive Key error', e);
  }

  // Asagidaki uc is birbirinden bagimsiz: jailbreak kontrolu, Firebase init ve
  // (anahtar zaten elde edilmis) Hive box'larini acma. Sirali degil, paralel.
  var isRooted = false;

  Future<void> checkRoot() async {
    try {
      isRooted = await JailbreakRootDetection.instance.isJailBroken;
    } catch (e) {
      Logger.w('Security check error', e);
    }
  }

  Future<void> initFirebase() async {
    if (Env.firebaseEnabled) {
      try {
        await Firebase.initializeApp();
        FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
      } catch (e) {
        Logger.e('Firebase init failed', e);
      }
    }
  }

  Future<void> openHiveBoxes() async {
    // Yerel degiskene alinip null-check burada yapiliyor: hiveKey disaridan
    // yakalanan (captured) degisken oldugu icin tip daraltmasinin (promotion)
    // her derleyicide sorunsuz calismasini garantiler.
    final key = hiveKey;
    if (key != null) {
      final cipher = HiveAesCipher(key);
      await Hive.openBox('pending_sync_actions', encryptionCipher: cipher);
      await Hive.openBox('partner_bookings_cache', encryptionCipher: cipher);
      await Hive.openBox('my_bookings_cache', encryptionCipher: cipher);
    } else {
      Logger.e(
        'Hive encryption key unavailable; caching disabled. Data will not persist across restarts.',
      );
    }
  }

  await Future.wait([checkRoot(), initFirebase(), openHiveBoxes()]);

  final app = EasyLocalization(
    supportedLocales: const [Locale('tr'), Locale('en')],
    path: 'assets/l10n',
    fallbackLocale: const Locale('tr'),
    child: const ProviderScope(child: BagajParkApp()),
  );

  runApp(isRooted ? RootWarningScreen(onContinue: () => runApp(app)) : app);
}

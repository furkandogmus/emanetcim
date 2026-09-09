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

/// SyncService (`pending_sync_actions`) ve cache saglayicilarinin (`*_cache`)
/// dayandigi Hive kutularini acar.
///
/// `hiveKey` alinamadiysa (ör. secure storage bozuk/erisilemez) ONCEDEN bu
/// kutular HIC ACILMAZDI: sonraki her senkron `Hive.box(name)` cagrisi
/// `HiveError('Box not found...')` firlatiyordu ve bu hata `SyncService.sync()`
/// gibi async fonksiyonlarin dondurdugu Future'a yansidigi icin hic
/// yakalanmiyor, hicbir yere raporlanmiyordu — offline check-in/check-out
/// kaydi sessizce kayboluyordu. Anahtar yoksa kutulari sifrelenmemis acarak
/// ozelligi ayakta tutuyoruz; bu yine de bir HiveError firlatirsa (ör. disk
/// bozuk) en azindan loglaniyor.
@visibleForTesting
Future<void> openHiveBoxes(
  List<int>? hiveKey, {
  List<String> boxNames = const [
    'pending_sync_actions',
    'partner_bookings_cache',
    'my_bookings_cache',
  ],
}) async {
  try {
    if (hiveKey != null) {
      final cipher = HiveAesCipher(hiveKey);
      for (final name in boxNames) {
        await Hive.openBox(name, encryptionCipher: cipher);
      }
    } else {
      Logger.e(
        'Hive encryption key unavailable; opening boxes unencrypted so '
        'offline sync/cache keep working.',
      );
      for (final name in boxNames) {
        await Hive.openBox(name);
      }
    }
  } catch (e, st) {
    Logger.e('Hive box open failed; offline sync/cache disabled', e, st);
  }
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

  await Future.wait([checkRoot(), initFirebase(), openHiveBoxes(hiveKey)]);

  // ProviderScope, runApp'in kok argumaninda SABIT sarmali: `riverpod_lint`
  // yalnizca bunu statik olarak dogrulayabiliyor -- iki ayri runApp() cagrisi
  // (biri RootWarningScreen icin, biri asil uygulama icin) ProviderScope'u
  // kosullu/gecikmeli kildigi icin "missing_provider_scope" uyarisi veriyordu.
  // RootWarningScreen Riverpod kullanmadigindan (duz StatelessWidget) bu bir
  // yanlis pozitifti, ama gate'i tek runApp() altina almak hem uyariyi gercekten
  // gideriyor hem de cift runApp() cagrisi anti-desenini kaldiriyor.
  runApp(
    ProviderScope(
      child: EasyLocalization(
        supportedLocales: const [Locale('tr'), Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('tr'),
        child: _RootGate(isRooted: isRooted),
      ),
    ),
  );
}

class _RootGate extends StatefulWidget {
  const _RootGate({required this.isRooted});
  final bool isRooted;

  @override
  State<_RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<_RootGate> {
  late bool _showRootWarning = widget.isRooted;

  @override
  Widget build(BuildContext context) {
    if (_showRootWarning) {
      return RootWarningScreen(
        onContinue: () => setState(() => _showRootWarning = false),
      );
    }
    return const BagajParkApp();
  }
}

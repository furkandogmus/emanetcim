import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tum test dosyalarindan once calisir (Flutter'in kesfettigi ozel dosya).
/// EasyLocalization ve SharedPreferences'i test ortaminda hazirlar; boylece
/// `.tr()` cagrilari ham anahtar yerine GERCEK cevirileri dondurur.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  // Fontlar assets/fonts'tan yuklenir; test ortaminda ag cagrisi mock'lu HttpClient'a
  // carpip yakalanmamis hata uretiyordu. Paketlenmemis bir varyant istenirse
  // burasi acikca patlar, sessizce fallback fonta dusmez.
  GoogleFonts.config.allowRuntimeFetching = false;
  SharedPreferences.setMockInitialValues(<String, Object>{});
  await EasyLocalization.ensureInitialized();
  await testMain();
}

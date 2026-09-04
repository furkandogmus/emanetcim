import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tum test dosyalarindan once calisir (Flutter'in kesfettigi ozel dosya).
/// EasyLocalization ve SharedPreferences'i test ortaminda hazirlar; boylece
/// `.tr()` cagrilari ham anahtar yerine GERCEK cevirileri dondurur.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  SharedPreferences.setMockInitialValues(<String, Object>{});
  await EasyLocalization.ensureInitialized();
  await testMain();
}

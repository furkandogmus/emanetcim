// Duman (smoke) testi: uygulamanin gercek giris ve ana ekranlari, harness'in
// `pumpApp`'i (gercek tema + Turkce ceviri + Riverpod) ile hatasiz ciziliyor mu?
//
// `flutter create` kalintisi eski hali sahte bir Scaffold(Text('BagajPark'))
// pump ediyordu; hicbir gercek widget'i tetiklemiyordu ve kirilan bir ekrani
// yakalayamazdi.
import 'package:bagajpark/core/auth/token_store.dart';
import 'package:bagajpark/features/auth/login_screen.dart';
import 'package:bagajpark/features/home/home_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/harness.dart';

/// Guvenli depoya (flutter_secure_storage) test ortaminda erisilemez;
/// biyometrik hesap listesi bos doner (bkz. login_screen_a11y_test.dart).
class _NoBiometricTokenStore extends TokenStore {
  @override
  Future<List<Map<String, String>>> getBiometricAccounts() async => [];
}

void main() {
  testWidgets('App smoke test: LoginScreen hatasiz ciziliyor', (tester) async {
    await pumpApp(
      tester,
      const LoginScreen(),
      overrides: [
        tokenStoreProvider.overrideWith((ref) => _NoBiometricTokenStore()),
      ],
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Hoş Geldiniz'), findsOneWidget);
    expect(find.text('Giriş Yap'), findsOneWidget);
  });

  testWidgets('App smoke test: HomeScreen hatasiz ciziliyor', (tester) async {
    await pumpApp(tester, const HomeScreen());

    expect(tester.takeException(), isNull);
    expect(find.text('Valizlerini Güvenle Emanet Edin'), findsOneWidget);
  });
}

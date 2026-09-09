// Login ekrani erisilebilirlik testi (viewport boyutundan bagimsiz).
// Harness gercek tema + Turkce cevirilerle pump eder; boylece guideline'lar
// ekranda gorunen gercek metin ve renkleri olcer, ham anahtari degil.
import 'package:bagajpark/core/auth/token_store.dart';
import 'package:bagajpark/features/auth/login_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/harness.dart';

/// Guvenli depoya (flutter_secure_storage) test ortaminda erisilemez;
/// biyometrik hesap listesi bos doner, ekran biyometrik butonu cizmez.
class _NoBiometricTokenStore extends TokenStore {
  @override
  Future<List<Map<String, String>>> getBiometricAccounts() async => [];
}

void main() {
  Future<void> pumpLogin(WidgetTester tester) => pumpApp(
    tester,
    const LoginScreen(),
    overrides: [
      tokenStoreProvider.overrideWith((ref) => _NoBiometricTokenStore()),
    ],
  );

  testWidgets('LoginScreen: gercek ceviriyle ciziliyor', (tester) async {
    await pumpLogin(tester);
    expect(find.text('Hoş Geldiniz'), findsOneWidget);
    expect(find.text('Giriş Yap'), findsOneWidget);
  });

  testWidgets('LoginScreen: dokunma hedefi >= 48dp', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpLogin(tester);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('LoginScreen: dokunulabilir dugumler etiketli', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpLogin(tester);
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    handle.dispose();
  });

  // textContrastGuideline bu ekranda BILEREK yok: algoritma dugum dikdortgenindeki
  // pikselleri ortalama acikliga gore ikiye bolup her gruptan en sik rengi alir.
  // Login'in dekoratif soluk turuncu dairesi (brandOrange %15) "koyu" gruba dusuyor
  // ve beyazla karsilastirilinca 1.2 cikiyor; metin rengi (0xFF424242) hic olculmuyor.
  // Yani sonuc dekoru olcer, metni degil. Kartlar gibi duz zeminli widget'larda gecerli.
}

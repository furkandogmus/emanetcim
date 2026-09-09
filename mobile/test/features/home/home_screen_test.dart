// Erisilebilirlik + davranis testi. HomeScreen sunucudan veri cekmez
// (yalnizca oturum durumunu okur), bu yuzden repository override'ina
// gerek yok. Navigasyon gerektiren aksiyonlar (context.push) go_router
// olmadan cagrilamayacagindan kapsam disi; "Nasil Calisir" alt sayfasi
// (showModalBottomSheet) router gerektirmez ve buradan dogrulanir.
import 'package:bagajpark/features/home/home_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/harness.dart';

void main() {
  Future<void> pump(WidgetTester tester) => pumpApp(tester, const HomeScreen());

  testWidgets('HomeScreen: gercek ceviriyle ciziliyor', (tester) async {
    await pump(tester);
    expect(find.text('Valizlerini Güvenle Emanet Edin'), findsOneWidget);
    expect(find.text('Merhaba, Misafir 👋'), findsOneWidget);
    expect(find.text('Popüler Şehirler'), findsOneWidget);
  });

  testWidgets(
    'HomeScreen: "Detayları Gör" nasil calisir alt sayfasini aciyor',
    (tester) async {
      await pump(tester);

      expect(find.text('Misafir Rehberi'), findsNothing);
      // Varsayilan test viewport'unda (800x600) CustomScrollView icerigi
      // tasar; dokunmadan once gorunur alana kaydir.
      await tester.ensureVisible(find.text('Detayları Gör'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Detayları Gör'));
      await tester.pumpAndSettle();

      expect(find.text('Misafir Rehberi'), findsOneWidget);
    },
  );

  testWidgets('HomeScreen: dokunma hedefi >= 48dp', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('HomeScreen: dokunulabilir dugumler etiketli', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    handle.dispose();
  });
}

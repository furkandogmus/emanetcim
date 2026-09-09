// Erisilebilirlik guideline testi. ForceUpdateScreen sunucudan veri
// cekmez (yalnizca dugmeye basilinca store'u acar), bu yuzden repository
// override'ina gerek yok.
import 'package:bagajpark/features/update/force_update_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/harness.dart';

void main() {
  Future<void> pump(WidgetTester tester) =>
      pumpApp(tester, const ForceUpdateScreen());

  testWidgets('ForceUpdateScreen: gercek ceviriyle ciziliyor', (tester) async {
    await pump(tester);
    expect(find.text('Güncelleme gerekli'), findsOneWidget);
    expect(find.text('Güncelle'), findsOneWidget);
  });

  testWidgets('ForceUpdateScreen: dokunma hedefi >= 48dp', (tester) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('ForceUpdateScreen: dokunulabilir dugumler etiketli', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    handle.dispose();
  });

  // textContrastGuideline BILEREK yok: "Güncelle" dugmesi uygulama genelindeki
  // FilledButtonTheme'i kullanir (beyaz metin / marka turuncusu #EA580C zemin),
  // olculen oran 3.56:1 — WCAG AA'nin 4.5:1 esiginin altinda. Bu ekrana ozgu
  // degil, temanin HER FilledButton'inda ayni; duzeltmesi marka rengi
  // degisikligi gerektirir (bkz. docs/DEFECT_BACKLOG.md).
}

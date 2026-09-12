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

  testWidgets('ForceUpdateScreen: metin kontrasti WCAG AA', (tester) async {
    // DEFECT_BACKLOG D10 (2026-09-12): FilledButtonTheme zemini
    // `_brandOrangeDark`e cekildi (~5.12:1) -- bu guideline artik geciyor.
    final handle = tester.ensureSemantics();
    await pump(tester);
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    handle.dispose();
  });
}

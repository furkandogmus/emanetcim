// Ortak ErrorState bileseninin widget testi. Baslik/aksiyon ciziliyor mu
// ve a11y guideline'lari geciyor mu kontrol eder.
import 'package:bagajpark/shared/widgets/error_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/harness.dart';

void main() {
  testWidgets('ErrorState: baslik ciziliyor, aksiyon yoksa dugme yok', (
    tester,
  ) async {
    await pumpApp(tester, const ErrorState(title: 'Bir hata olustu'));

    expect(find.text('Bir hata olustu'), findsOneWidget);
    expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
    expect(find.byType(TextButton), findsNothing);
  });

  testWidgets('ErrorState: aksiyon dugmesi verilince ciziliyor ve tetiklenir', (
    tester,
  ) async {
    var tapped = false;
    await pumpApp(
      tester,
      ErrorState(
        title: 'Bir hata olustu',
        actionLabel: 'Tekrar Dene',
        onAction: () => tapped = true,
      ),
    );

    expect(find.text('Tekrar Dene'), findsOneWidget);
    await tester.tap(find.text('Tekrar Dene'));
    await tester.pumpAndSettle();
    expect(tapped, isTrue);
  });

  testWidgets('ErrorState: dokunma hedefi >= 48dp', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      ErrorState(
        title: 'Bir hata olustu',
        actionLabel: 'Tekrar Dene',
        onAction: () {},
      ),
    );
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('ErrorState: dokunulabilir dugumler etiketli', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      ErrorState(
        title: 'Bir hata olustu',
        actionLabel: 'Tekrar Dene',
        onAction: () {},
      ),
    );
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('ErrorState: metin kontrasti WCAG AA', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      const ErrorState(
        title: 'Bir hata olustu',
        description: 'Lutfen tekrar deneyin',
      ),
    );
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    handle.dispose();
  });
}

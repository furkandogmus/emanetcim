// Ortak EmptyState bileseninin widget testi. Baslik/aciklama/aksiyon
// ciziliyor mu ve a11y guideline'lari geciyor mu kontrol eder.
import 'package:bagajpark/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/harness.dart';

void main() {
  testWidgets('EmptyState: baslik ve aciklama ciziliyor', (tester) async {
    await pumpApp(
      tester,
      const EmptyState(
        icon: Icons.luggage_outlined,
        title: 'Baslik metni',
        description: 'Aciklama metni',
      ),
    );

    expect(find.text('Baslik metni'), findsOneWidget);
    expect(find.text('Aciklama metni'), findsOneWidget);
    expect(find.byIcon(Icons.luggage_outlined), findsOneWidget);
    expect(find.byType(FilledButton), findsNothing);
  });

  testWidgets('EmptyState: aksiyon dugmesi verilince ciziliyor ve tetiklenir', (
    tester,
  ) async {
    var tapped = false;
    await pumpApp(
      tester,
      EmptyState(
        icon: Icons.luggage_outlined,
        title: 'Baslik metni',
        actionLabel: 'Devam Et',
        actionIcon: Icons.search_rounded,
        onAction: () => tapped = true,
      ),
    );

    expect(find.text('Devam Et'), findsOneWidget);
    await tester.tap(find.text('Devam Et'));
    await tester.pumpAndSettle();
    expect(tapped, isTrue);
  });

  testWidgets('EmptyState: dokunma hedefi >= 48dp', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      EmptyState(
        icon: Icons.luggage_outlined,
        title: 'Baslik metni',
        actionLabel: 'Devam Et',
        onAction: () {},
      ),
    );
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('EmptyState: dokunulabilir dugumler etiketli', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      EmptyState(
        icon: Icons.luggage_outlined,
        title: 'Baslik metni',
        actionLabel: 'Devam Et',
        onAction: () {},
      ),
    );
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('EmptyState: metin kontrasti WCAG AA', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpApp(
      tester,
      const EmptyState(
        icon: Icons.luggage_outlined,
        title: 'Baslik metni',
        description: 'Aciklama metni',
      ),
    );
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    handle.dispose();
  });
}

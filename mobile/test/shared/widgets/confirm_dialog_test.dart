import 'package:bagajpark/shared/widgets/confirm_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

  testWidgets('ConfirmDialog iptal ile false döner', (tester) async {
    bool? result;
    await tester.pumpWidget(
      wrap(
        Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              result = await ConfirmDialog.show(
                context,
                title: 'Çıkış Yap',
                message: 'Emin misiniz?',
                cancelLabel: 'İptal',
                confirmLabel: 'Çıkış Yap',
                destructive: true,
              );
            },
            child: const Text('aç'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('aç'));
    await tester.pumpAndSettle();

    expect(find.text('Çıkış Yap'), findsNWidgets(2)); // başlık + buton
    expect(find.text('Emin misiniz?'), findsOneWidget);
    expect(find.text('İptal'), findsOneWidget);

    await tester.tap(find.text('İptal'));
    await tester.pumpAndSettle();

    expect(result, isFalse);
  });

  testWidgets('ConfirmDialog onayla ile true döner', (tester) async {
    bool? result;
    await tester.pumpWidget(
      wrap(
        Builder(
          builder: (context) => ElevatedButton(
            onPressed: () async {
              result = await ConfirmDialog.show(
                context,
                title: 'Hesabı Sil',
                message: 'Geri alınamaz.',
                cancelLabel: 'İptal',
                confirmLabel: 'Onayla',
                destructive: true,
              );
            },
            child: const Text('aç'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('aç'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Onayla'));
    await tester.pumpAndSettle();

    expect(result, isTrue);
  });

  testWidgets('cancelLabel verilmezse tek butonlu bilgi dialogu olur', (
    tester,
  ) async {
    await tester.pumpWidget(
      wrap(
        Builder(
          builder: (context) => ElevatedButton(
            onPressed: () => ConfirmDialog.show(
              context,
              title: 'Mühür Bilgisi',
              message: 'Seri No: 12345',
              confirmLabel: 'Tamam',
            ),
            child: const Text('aç'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('aç'));
    await tester.pumpAndSettle();

    expect(find.byType(TextButton), findsOneWidget);
    expect(find.text('Tamam'), findsOneWidget);
  });
}

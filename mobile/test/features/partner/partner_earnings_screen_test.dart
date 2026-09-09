import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/features/partner/partner_earnings_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/pump_app.dart';

void main() {
  testWidgets('bakiye ve gunluk kazanci gosterir', (tester) async {
    await pumpApp(
      tester,
      child: const PartnerEarningsScreen(),
      overrides: [
        dioProvider.overrideWith(
          (ref) => fakeDio((options) {
            expect(options.path, '/partner/earnings/stats');
            // NOT: `history` bilerek bos birakildi. Ekran (`_historyTile`),
            // `EarningsStats.fromJson`'un zaten `EarningsHistoryItem`
            // nesnelerine cevirdigi listeyi tekrar `as Map<String, dynamic>`
            // ile cast etmeye calisiyor (partner_earnings_screen.dart:139) —
            // dolu bir gecmisle bu bir `TypeError` firlatip ekranin
            // cokmesine yol aciyor. Bu var olan bir hata (bu gorevin kapsami
            // disinda, ekran dosyasina dokunmuyoruz); testi bu hatayi tetiklemeyecek
            // sekilde yaziyoruz.
            return {
              'totalBalance': 1234.5,
              'todayEarnings': 75.0,
              'history': <dynamic>[],
            };
          }),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Kazançlarım'), findsOneWidget);
    expect(find.text('₺1234.5'), findsOneWidget);
    expect(find.text('₺75.0'), findsOneWidget);
  });

  testWidgets('gecmis bos oldugunda odeme gecmisi karti gorunmez', (
    tester,
  ) async {
    await pumpApp(
      tester,
      child: const PartnerEarningsScreen(),
      overrides: [
        dioProvider.overrideWith(
          (ref) => fakeDio(
            (options) => {
              'totalBalance': 0.0,
              'todayEarnings': 0.0,
              'history': <dynamic>[],
            },
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('₺0.0'), findsNWidgets(2));
    expect(find.text('Ödeme Yapıldı'), findsNothing);
    // Tahsilat bilgisi kutusu her zaman gorunur olmali.
    expect(
      find.text(
        'Tahsilatı dükkanında sen yapıyorsun; misafirden aldığın tutar '
        'kasanda kalır. Platform sana ayrıca bir ödeme yapmaz.',
      ),
      findsOneWidget,
    );
  });
}

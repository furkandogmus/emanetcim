import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/features/partner/partner_earnings_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/pump_app.dart';

void main() {
  testWidgets(
    // Regresyon (2026-09-11): `_fetchStats` hatayi `_stats.error`e
    // yaziyordu ama `build()` bunu hic okumuyordu -- ag hatasinda esnaf
    // GERCEKTEN ₺0 kazandigini saniyordu, hata gizleniyordu.
    'ag hatasinda sessizce ₺0 gostermez, hata durumu + tekrar dene gosterir',
    (tester) async {
      await pumpApp(
        tester,
        child: const PartnerEarningsScreen(),
        overrides: [dioProvider.overrideWith((ref) => fakeDioError())],
      );
      await tester.pumpAndSettle();

      expect(find.text('₺0'), findsNothing);
      expect(find.text('Bir hata oluştu'), findsOneWidget);
      expect(find.text('Tekrar Dene'), findsOneWidget);
    },
  );

  testWidgets('bakiye ve gunluk kazanci gosterir', (tester) async {
    await pumpApp(
      tester,
      child: const PartnerEarningsScreen(),
      overrides: [
        dioProvider.overrideWith(
          (ref) => fakeDio((options) {
            expect(options.path, '/partner/earnings/stats');
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

  testWidgets(
    // Regresyon: `EarningsStats.fromJson`, `history`'yi zaten
    // `EarningsHistoryItem` nesnelerine ceviriyor. Ekran (`_historyTile`)
    // bunu tekrar `as Map<String, dynamic>` ile cast etmeye calisiyordu
    // (partner_earnings_screen.dart) -- dolu bir gecmisle bu her zaman bir
    // `TypeError` firlatip ekranin cokmesine yol aciyordu.
    'dolu odeme gecmisi ekrani coktürmeden gosterilir',
    (tester) async {
      await pumpApp(
        tester,
        child: const PartnerEarningsScreen(),
        overrides: [
          dioProvider.overrideWith(
            (ref) => fakeDio(
              (options) => {
                'totalBalance': 1234.5,
                'todayEarnings': 75.0,
                'history': [
                  {
                    'date': '2026-09-01',
                    'amount': 150.0,
                    'bookingId': 'b-1',
                    'status': 'PAID',
                  },
                ],
              },
            ),
          ),
        ],
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('2026-09-01'), findsOneWidget);
      expect(find.text('+₺150.0'), findsOneWidget);
    },
  );

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

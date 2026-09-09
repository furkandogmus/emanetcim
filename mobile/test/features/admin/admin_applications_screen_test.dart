import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/features/admin/admin_applications_screen.dart';
import 'package:bagajpark/features/admin/admin_controller.dart';
import 'package:bagajpark/shared/models/admin_stats.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/pump_app.dart';

void main() {
  List<dynamic> pendingApps() => [
    {
      'id': 'app-1',
      'name': 'Test Dukkan',
      'address': 'Test Adres 1',
      'owner': {'name': 'Ali Veli', 'phone': '5551112233'},
    },
  ];

  testWidgets('bekleyen basvuru kartini gosterir', (tester) async {
    await pumpApp(
      tester,
      child: const AdminApplicationsScreen(),
      overrides: [
        dioProvider.overrideWith((ref) => fakeDio((options) => pendingApps())),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Başvuruları Onayla'), findsOneWidget); // appbar
    expect(find.text('Test Dukkan'), findsOneWidget);
    expect(find.text('Test Adres 1'), findsOneWidget);
    expect(find.text('Ali Veli'), findsOneWidget);
    expect(find.text('5551112233'), findsOneWidget);
  });

  testWidgets('bos basvuru listesinde bilgi mesaji gosterir', (tester) async {
    await pumpApp(
      tester,
      child: const AdminApplicationsScreen(),
      overrides: [
        dioProvider.overrideWith((ref) => fakeDio((options) => <dynamic>[])),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Bekleyen başvuru bulunmuyor.'), findsOneWidget);
  });

  testWidgets('onayla butonu basvuruyu onaylar ve listeyi yeniler', (
    tester,
  ) async {
    var callCount = 0;
    await pumpApp(
      tester,
      child: const AdminApplicationsScreen(),
      overrides: [
        dioProvider.overrideWith(
          (ref) => fakeDio((options) {
            if (options.method == 'POST') {
              expect(options.path, '/admin/applications/app-1/approve');
              return null;
            }
            callCount++;
            // Ikinci GET cagrisinda (onaydan sonraki yenileme) liste bos
            // donsun; boylece "islem gercekten tekrar veri cekti mi" ayri
            // bir sekilde dogrulanabiliyor.
            return callCount == 1 ? pendingApps() : <dynamic>[];
          }),
        ),
      ],
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Onayla'));
    await tester.pumpAndSettle();

    expect(find.text('Başvuru onaylandı'), findsOneWidget);
    expect(find.text('Bekleyen başvuru bulunmuyor.'), findsOneWidget);
  });

  testWidgets(
    'onayla basvurunun ardindan dashboard istatistik onbellegini gecersiz kilar',
    (tester) async {
      var callCount = 0;
      var statsBuildCount = 0;
      await pumpApp(
        tester,
        // `adminStatsProvider`'i aktif dinleyicili tutmak icin ekranin
        // yaninda onu izleyen bir Consumer de agaca ekliyoruz; aksi halde
        // dinleyicisiz bir provider'da `ref.invalidate` cagrildiginda hemen
        // yeniden hesaplanmaz ve testin geriye kalan kismi hicbir sey
        // gozlemleyemez.
        child: Column(
          children: [
            const Expanded(child: AdminApplicationsScreen()),
            Consumer(
              builder: (context, ref, _) {
                ref.watch(adminStatsProvider);
                return const SizedBox.shrink();
              },
            ),
          ],
        ),
        overrides: [
          dioProvider.overrideWith(
            (ref) => fakeDio((options) {
              if (options.method == 'POST') {
                return null;
              }
              callCount++;
              return callCount == 1 ? pendingApps() : <dynamic>[];
            }),
          ),
          adminStatsProvider.overrideWith((ref) async {
            statsBuildCount++;
            return const AdminStatsDto(
              totalBookings: 0,
              totalRevenue: 0,
              totalPartners: 0,
              pendingApplications: 0,
              unreadMessages: 0,
            );
          }),
        ],
      );
      await tester.pumpAndSettle();

      expect(statsBuildCount, 1);

      await tester.tap(find.text('Onayla'));
      await tester.pumpAndSettle();

      expect(statsBuildCount, 2);
    },
  );
}

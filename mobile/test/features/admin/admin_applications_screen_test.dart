import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/features/admin/admin_applications_screen.dart';
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
}

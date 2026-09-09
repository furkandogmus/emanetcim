import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/features/partner/partner_settings_screen.dart';
import 'package:bagajpark/shared/widgets/error_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/pump_app.dart';

void main() {
  Map<String, dynamic> shopJson() => {
    'id': 'shop-1',
    'name': 'Test Dukkan',
    'pricePerDay': 50.0,
    'capacity': 10,
    'openingTime': '09:00',
    'closingTime': '20:00',
    'address': 'Test Adres',
    'city': 'Istanbul',
    'district': 'Kadikoy',
    'phone': '5551112233',
    'sealCount': 7,
  };

  testWidgets('dukkan bilgilerini formda gosterir', (tester) async {
    await pumpApp(
      tester,
      child: const PartnerSettingsScreen(),
      overrides: [
        dioProvider.overrideWith(
          (ref) => fakeDio((options) {
            expect(options.path, '/partner/shop');
            return shopJson();
          }),
        ),
      ],
      extraRoutes: {
        '/partner/seals': (context) =>
            const Scaffold(body: Text('muhur-yonetimi-stub')),
      },
    );
    await tester.pumpAndSettle();

    expect(find.text('Dükkan Ayarları'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Dükkan Adı'), findsOneWidget);
    final nameField = tester.widget<TextFormField>(
      find.widgetWithText(TextFormField, 'Dükkan Adı'),
    );
    expect(nameField.controller?.text, 'Test Dukkan');
    // Muhur sayisi API'den gelen sealCount ile gosteriliyor.
    expect(find.text('7 Adet'), findsOneWidget);
  });

  testWidgets('muhur yonetimi karti tiklandiginda ilgili ekrana gider', (
    tester,
  ) async {
    await pumpApp(
      tester,
      child: const PartnerSettingsScreen(),
      overrides: [
        dioProvider.overrideWith((ref) => fakeDio((options) => shopJson())),
      ],
      extraRoutes: {
        '/partner/seals': (context) =>
            const Scaffold(body: Text('muhur-yonetimi-stub')),
      },
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Mühür Yönetimi').first);
    await tester.pumpAndSettle();

    expect(find.text('muhur-yonetimi-stub'), findsOneWidget);
  });

  testWidgets(
    // Regresyon: `_fetchShop()`'un catch bloğu `_loading`'i hiç false
    // yapmıyordu; ekran (`if (_loading) return ...CircularProgressIndicator`)
    // ağ hatasında kalıcı olarak dönen bir spinnerda takılıp kalıyordu ve
    // "tekrar dene" gibi bir kurtarma yolu yoktu.
    'dukkan bilgisi cekilemezse sonsuz spinnerda takilmaz, tekrar dene sunar',
    (tester) async {
      await pumpApp(
        tester,
        child: const PartnerSettingsScreen(),
        overrides: [dioProvider.overrideWith((ref) => fakeDioError())],
      );
      await tester.pumpAndSettle();

      // Spinner degil, tekrar dene aksiyonlu bir hata gorunumu gosterilir.
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.byType(ErrorState), findsOneWidget);
      expect(find.text('Tekrar Dene'), findsOneWidget);

      // "Tekrar dene" tekrar `_fetchShop()`'u tetikler.
      await tester.tap(find.text('Tekrar Dene'));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Dio'nun ikinci istegini (yine ayni hatayla) tamamen tuketip
      // bekleyen zamanlayicilari bosaltiyoruz; aksi halde test, dispose
      // sonrasi hala bekleyen bir Timer birakip basarisiz olur.
      await tester.pumpAndSettle();
      expect(find.byType(ErrorState), findsOneWidget);
    },
  );
}

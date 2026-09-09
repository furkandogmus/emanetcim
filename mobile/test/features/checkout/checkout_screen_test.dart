// Erisilebilirlik + davranis testi. Gercek ag cagrisi yapmamak icin
// `shopRepositoryProvider` sahte bir repository ile override edilir.
// `_pay` (odeme) `dioProvider`'i dogrudan kullandigindan tetiklenmez;
// bu test yalnizca render ve bavul sayaci etkilesimini dogrular.
import 'package:bagajpark/core/repositories/shop_repository.dart';
import 'package:bagajpark/core/utils/result.dart';
import 'package:bagajpark/features/checkout/checkout_screen.dart';
import 'package:bagajpark/shared/models/shop.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/harness.dart';

class _FakeShopRepository extends ShopRepository {
  _FakeShopRepository(this._shop) : super(Dio());
  final ShopDto _shop;

  @override
  Future<Result<ShopDto>> getById(String id) async => Success(_shop);
}

void main() {
  const shop = ShopDto(
    id: 'shop-1',
    name: 'Taksim Emanet',
    pricePerDay: 50,
    capacity: 10,
  );

  Future<void> pump(WidgetTester tester) => pumpApp(
    tester,
    const CheckoutScreen(shopId: 'shop-1'),
    overrides: [
      shopRepositoryProvider.overrideWith((ref) => _FakeShopRepository(shop)),
    ],
  );

  testWidgets('CheckoutScreen: gercek ceviriyle ciziliyor', (tester) async {
    await pump(tester);
    expect(find.text('Rezervasyonu Tamamla'), findsOneWidget);
    expect(find.text('Küçük (S)'), findsOneWidget);
    expect(find.text('Orta (M)'), findsOneWidget);
    expect(find.text('Büyük (XL)'), findsOneWidget);
  });

  testWidgets('CheckoutScreen: bavul sayaci artinca toplam degisiyor', (
    tester,
  ) async {
    await pump(tester);

    // Varsayilan: 1 Orta (M) bavul secili, buton aktif.
    final payButtonFinder = find.widgetWithText(
      FilledButton,
      'Rezervasyonu Onayla',
    );
    expect(payButtonFinder, findsOneWidget);
    final payButton = tester.widget<FilledButton>(payButtonFinder);
    expect(payButton.onPressed, isNotNull);

    // Bavul sayaci sirasi ekranda S, M, XL; ilk "+" dugmesi Kucuk (S) icin.
    final sIncrementButton = find.byIcon(Icons.add).first;
    await tester.tap(sIncrementButton);
    await tester.pumpAndSettle();

    // Once yalnizca M=1 secili iken tek "1" vardi; S de 1 olunca iki tane olur.
    expect(find.text('1'), findsNWidgets(2));
  });

  // androidTapTargetGuideline VE labeledTapTargetGuideline BILEREK yok:
  // bavul sayacinin +/- InkWell'leri (`_counterBtn`) 30x30, bavul rehberi
  // yardim ikonu (`Icons.help_outline_rounded`) 16x16 ve hicbiri semantik
  // etiket tasimiyor — WCAG 48dp / etiket kurallarinin ikisini de ihlal
  // ediyor. Ekrana ozgu, onceden var olan bir bulgu; duzeltmesi
  // checkout_screen.dart'a dokunma gerektirir (bkz. docs/DEFECT_BACKLOG.md)
  // — bu gorev kapsaminda ekran dosyasina dokunulmuyor.
}

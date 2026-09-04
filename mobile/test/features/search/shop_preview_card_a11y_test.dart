// Erisilebilirlik guideline testi (viewport boyutundan bagimsiz).
// androidTapTargetGuideline: dokunulabilir alanlar >= 48x48 dp.
// labeledTapTargetGuideline: dokunulabilir dugumlerin bir etiketi olmali.
// textContrastGuideline: metin/arka plan WCAG AA kontrast.
import 'package:bagajpark/features/search/widgets/shop_preview_card.dart';
import 'package:bagajpark/shared/models/shop.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:network_image_mock/network_image_mock.dart';

void main() {
  const shop = ShopDto(
    id: 'a11y-1',
    name: 'Sultanahmet Emanet Noktasi',
    address: 'Divanyolu Caddesi No 12, Fatih',
    latitude: 41.0,
    longitude: 28.0,
    rating: 4.8,
    pricePerDay: 120.0,
    capacity: 25,
    distanceKm: 1.4,
  );

  Future<void> pumpCard(WidgetTester tester) async {
    await mockNetworkImagesFor(() async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: Center(child: ShopPreviewCard(shop: shop, isSelected: false)),
            ),
          ),
        ),
      );
    });
  }

  testWidgets('ShopPreviewCard: dokunma hedefi >= 48dp', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpCard(tester);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    handle.dispose();
  });

  testWidgets('ShopPreviewCard: dokunulabilir dugumler etiketli', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpCard(tester);
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    handle.dispose();
  });
}

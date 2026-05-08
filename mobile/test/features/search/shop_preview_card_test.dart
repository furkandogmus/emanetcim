import 'package:bagajpark/features/search/widgets/shop_preview_card.dart';
import 'package:bagajpark/shared/models/shop.dart';
import 'package:bagajpark/shared/utils/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:network_image_mock/network_image_mock.dart';

void main() {
  const testShop = ShopDto(
    id: 'test-1',
    name: 'Test Shop',
    address: 'Test Address',
    latitude: 41.0,
    longitude: 28.0,
    rating: 4.5,
    pricePerDay: 50.0,
    capacity: 10,
  );

  testWidgets('ShopPreviewCard displays shop details correctly', (
    WidgetTester tester,
  ) async {
    await mockNetworkImagesFor(() async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ShopPreviewCard(shop: testShop, isSelected: false),
          ),
        ),
      );

      expect(find.text('Test Shop'), findsOneWidget);
      expect(find.textContaining('₺50'), findsOneWidget);
      expect(find.textContaining('4.5'), findsOneWidget);
    });
  });

  testWidgets('ShopPreviewCard shows orange border when selected', (
    WidgetTester tester,
  ) async {
    await mockNetworkImagesFor(() async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ShopPreviewCard(shop: testShop, isSelected: true),
          ),
        ),
      );

      final container = tester.widget<AnimatedContainer>(
        find.byType(AnimatedContainer),
      );
      final decoration = container.decoration as BoxDecoration;
      expect(decoration.border?.top.color, AppColors.brandOrange);
    });
  });
}

import 'package:bagajpark/features/search/search_filters_controller.dart';
import 'package:bagajpark/shared/models/shop.dart';
import 'package:flutter_test/flutter_test.dart';

ShopDto _shop(String id, double price, double? rating) =>
    ShopDto(id: id, name: id, pricePerDay: price, capacity: 10, rating: rating);

void main() {
  // Regresyon: search_filters_controller.dart applySearchFilters, hicbir
  // where-filtresi aktif degilken sirali (price/rating) yerinde (in-place)
  // yapiyordu; bu da girdi listesini (pratikte nearbyShopsProvider'in
  // onbellekteki listesi) kalici olarak mutasyona ugratiyordu. Bkz. rapor
  // "high/state-management" bulgusu.
  test('sortBy=price ile cagirmak GIRDI listesini yerinde degistirmez', () {
    final original = [_shop('c', 30, 1), _shop('a', 10, 2), _shop('b', 20, 3)];
    final originalOrderSnapshot = original.map((s) => s.id).toList();

    final sorted = applySearchFilters(
      original,
      const SearchFilters(sortBy: 'price'),
    );

    // Donen liste beklendigi gibi fiyata gore sirali.
    expect(sorted.map((s) => s.id).toList(), ['a', 'b', 'c']);
    // Ama orijinal girdi listesi (provider'in onbellekteki referansi)
    // DEGISMEMIS olmali.
    expect(original.map((s) => s.id).toList(), originalOrderSnapshot);
  });

  test('sortBy=rating ile cagirmak GIRDI listesini yerinde degistirmez', () {
    final original = [_shop('c', 30, 1), _shop('a', 10, 3), _shop('b', 20, 2)];
    final originalOrderSnapshot = original.map((s) => s.id).toList();

    final sorted = applySearchFilters(
      original,
      const SearchFilters(sortBy: 'rating'),
    );

    expect(sorted.map((s) => s.id).toList(), ['a', 'b', 'c']);
    expect(original.map((s) => s.id).toList(), originalOrderSnapshot);
  });

  test(
    'once price sonra distance sirasina donulunce orijinal sira geri gelir',
    () {
      // Onceki hatada: L1 = distance-sirali liste. price sortu L1'i yerinde
      // bozuyordu; sonra distance'a donulunce orijinal sira sonsuza dek
      // kayboluyordu. Simdi L1 hicbir zaman mutasyona ugramadigi icin
      // distance sirasi (girdi sirasi) her zaman geri getirilebilir.
      final l1 = [
        _shop('near', 30, 1),
        _shop('mid', 10, 2),
        _shop('far', 20, 3),
      ];
      final originalOrder = l1.map((s) => s.id).toList();

      applySearchFilters(l1, const SearchFilters(sortBy: 'price'));
      final backToDistance = applySearchFilters(l1, const SearchFilters());

      expect(l1.map((s) => s.id).toList(), originalOrder);
      expect(backToDistance.map((s) => s.id).toList(), originalOrder);
    },
  );
}

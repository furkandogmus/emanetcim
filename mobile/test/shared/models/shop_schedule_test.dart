import 'package:flutter_test/flutter_test.dart';
import 'package:bagajpark/shared/models/shop.dart';

void main() {
  test('detay yaniti haftalik saat ve izinleri okur', () {
    final shop = ShopDto.fromJson({
      'id': 's1',
      'name': 'Dukkan',
      'pricePerDay': 250,
      'capacity': 10,
      'weeklyHours': [
        {
          'weekday': 7,
          'isClosed': true,
          'openingTime': '09:00',
          'closingTime': '20:00',
        },
      ],
      'closures': [
        {'startDate': '2030-01-14', 'endDate': '2030-01-15'},
      ],
    });
    expect(shop.weeklyHours.single.isClosed, isTrue);
    expect(shop.closures.single.endDate, '2030-01-15');
  });

  test('liste yaniti takvimsiz gelir, alanlar bos liste olur', () {
    final shop = ShopDto.fromJson({
      'id': 's1',
      'name': 'Dukkan',
      'pricePerDay': 250,
      'capacity': 10,
    });
    expect(shop.weeklyHours, isEmpty);
    expect(shop.closures, isEmpty);
  });
}

import 'package:bagajpark/shared/models/booking.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Booking Logic Tests', () {
    test('Calculate total bags correctly', () {
      final booking = BookingDto(
        id: '1',
        shopId: 's1',
        shopName: 'Shop',
        checkInTime: DateTime.now(),
        checkOutTime: DateTime.now().add(const Duration(hours: 4)),
        bagCountS: 2,
        bagCountM: 3,
        bagCountXl: 1,
        totalPrice: 100,
        status: BookingStatus.paid,
      );

      expect(booking.totalBags, 6);
    });

    test('Pricing logic placeholder check', () {
      // Future: test actual pricing formula if moved to model/helper
    });
  });
}

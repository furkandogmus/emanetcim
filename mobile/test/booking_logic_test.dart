import 'package:flutter_test/flutter_test.dart';
import 'package:bagajpark/shared/models/booking.dart';

void main() {
  group('Booking Logic Tests', () {
    test('Calculate total bags correctly', () {
      const booking = BookingDto(
        id: '1',
        shopId: 's1',
        shopName: 'Shop',
        checkInTime: null,
        checkOutTime: null,
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

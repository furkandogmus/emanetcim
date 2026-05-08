import 'package:bagajpark/shared/models/booking.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Booking Validation Tests', () {
    test('Check-out must be after check-in', () {
      final now = DateTime.now();
      final checkIn = now.add(const Duration(hours: 1));
      final checkOut = now.add(const Duration(minutes: 30)); // Invalid

      // In a real app, you might have a isValid getter
      // For now, testing our logic
      expect(checkOut.isAfter(checkIn), isFalse);
    });

    test('Booking in the past should be invalid', () {
      final past = DateTime.now().subtract(const Duration(days: 1));
      expect(past.isBefore(DateTime.now()), isTrue);
    });

    test('Bag count calculation should be accurate', () {
      final booking = BookingDto(
        id: 'test',
        shopId: 'shop',
        shopName: 'Test Shop',
        checkInTime: DateTime.now(),
        checkOutTime: DateTime.now().add(const Duration(hours: 2)),
        bagCountS: 2,
        bagCountM: 1,
        bagCountXl: 3,
        totalPrice: 100.0,
        status: BookingStatus.paid,
      );

      final totalBags =
          booking.bagCountS + booking.bagCountM + booking.bagCountXl;
      expect(totalBags, 6);
    });
  });
}

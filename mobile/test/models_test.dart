import 'package:flutter_test/flutter_test.dart';
import 'package:bagajpark/shared/models/user.dart';
import 'package:bagajpark/shared/models/booking.dart';
import 'package:bagajpark/shared/models/seal.dart';

void main() {
  group('Model Serialization Tests', () {
    test('UserDto JSON serialization', () {
      final json = {
        'id': 'user-1',
        'email': 'test@example.com',
        'name': 'Test User',
        'role': 'GUEST', // Backend format
      };

      final user = UserDto.fromJson(json);

      expect(user.id, 'user-1');
      expect(user.role, UserRole.guest);
      expect(
        user.toJson()['role'],
        'GUEST',
      ); // Should serialize back to backend format
    });

    test('BookingDto JSON serialization', () {
      final json = {
        'id': 'booking-1',
        'shopId': 'shop-1',
        'shopName': 'Test Shop',
        'checkInTime': '2026-04-22T10:00:00.000Z',
        'checkOutTime': '2026-04-22T12:00:00.000Z',
        'bagCountS': 1,
        'bagCountM': 2,
        'bagCountXl': 0,
        'totalPrice': 150.0,
        'status': 'PAID',
      };

      final booking = BookingDto.fromJson(json);

      expect(booking.id, 'booking-1');
      expect(booking.status, BookingStatus.paid);
      expect(booking.totalBags, 3);
      expect(booking.toJson()['status'], 'PAID');
    });

    test('SealStatus JSON serialization', () {
      final json = {'serialNumber': 12345, 'status': 'IN_USE'};

      final seal = SealDto.fromJson(json);

      expect(seal.serialNumber, 12345);
      expect(seal.status, SealStatus.inUse);
      expect(seal.toJson()['status'], 'IN_USE');
    });
  });
}

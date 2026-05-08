import 'package:bagajpark/core/repositories/booking_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:mocktail/mocktail.dart';

class MockDio extends Mock implements Dio {}

class MockBox extends Mock implements Box {}

void main() {
  late BookingRepository repository;
  late MockDio mockDio;
  late MockBox mockBox;

  setUp(() {
    mockDio = MockDio();
    mockBox = MockBox();
    repository = BookingRepository(mockDio, myBookingsBox: mockBox);
  });

  group('BookingRepository Tests', () {
    final mockBookingData = {
      'id': 'b1',
      'shopId': 's1',
      'shopName': 'Test Shop',
      'checkInTime': '2024-04-24T10:00:00Z',
      'checkOutTime': '2024-04-25T10:00:00Z',
      'status': 'PAID',
      'totalPrice': 100.0,
      'bagCountS': 1,
      'bagCountM': 0,
      'bagCountXl': 0,
    };

    test('getMyBookings returns Success and caches data', () async {
      // Arrange
      when(() => mockDio.get('/bookings/me')).thenAnswer(
        (_) async => Response(
          data: [mockBookingData],
          statusCode: 200,
          requestOptions: RequestOptions(path: '/bookings/me'),
        ),
      );
      when(() => mockBox.put(any(), any())).thenAnswer((_) async => {});

      // Act
      final result = await repository.getMyBookings();

      // Assert
      expect(result.isSuccess, true);
      expect(result.data!.length, 1);
      verify(() => mockBox.put('list', any())).called(1);
    });

    test('getMyBookings returns cached data on network failure', () async {
      // Arrange
      when(() => mockDio.get('/bookings/me')).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/bookings/me'),
          type: DioExceptionType.connectionError,
        ),
      );
      when(() => mockBox.get('list')).thenReturn([mockBookingData]);

      // Act
      final result = await repository.getMyBookings();

      // Assert
      expect(result.isSuccess, true);
      expect(result.data!.length, 1);
    });
  });
}

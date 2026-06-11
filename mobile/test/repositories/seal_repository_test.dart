import 'package:bagajpark/core/repositories/seal_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late SealRepository repository;
  late MockDio mockDio;

  setUp(() {
    mockDio = MockDio();
    repository = SealRepository(mockDio);
  });

  group('SealRepository Tests', () {
    test('scan returns Success with data on 200', () async {
      // Arrange
      final responseData = {
        'type': 'booking',
        'id': 'booking-123',
        'status': 'active',
      };

      when(
        () => mockDio.post('/seals/scan', data: any(named: 'data')),
      ).thenAnswer(
        (_) async => Response(
          data: responseData,
          statusCode: 200,
          requestOptions: RequestOptions(path: '/seals/scan'),
        ),
      );

      // Act
      final result = await repository.scan('QR-CODE-123');

      // Assert
      expect(result.isSuccess, true);
      expect(result.data!.type, 'booking');
      expect(result.data!.id, 'booking-123');
    });

    test('scan returns Failure on 404', () async {
      // Arrange
      when(
        () => mockDio.post('/seals/scan', data: any(named: 'data')),
      ).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/seals/scan'),
          response: Response(
            statusCode: 404,
            requestOptions: RequestOptions(path: '/seals/scan'),
            data: {'message': 'Seal not found'},
          ),
          message: 'Not Found',
          type: DioExceptionType.badResponse,
        ),
      );

      // Act
      final result = await repository.scan('INVALID-QR');

      // Assert
      expect(result.isFailure, true);
      expect(result.error, contains('Not Found'));
    });
  });
}

import 'package:bagajpark/core/repositories/shop_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockDio extends Mock implements Dio {}

void main() {
  late ShopRepository repository;
  late MockDio mockDio;

  setUp(() {
    mockDio = MockDio();
    repository = ShopRepository(mockDio);
  });

  group('ShopRepository Tests', () {
    test('getShops returns Success with list of shops on 200', () async {
      // Arrange
      final responseData = [
        {
          'id': '1',
          'name': 'Test Shop',
          'address': 'Test Address',
          'latitude': 41.0,
          'longitude': 29.0,
          'pricePerDay': 50.0,
          'capacity': 10,
          'rating': 4.5,
          'isActive': true,
        },
      ];

      when(
        () => mockDio.get(
          '/shops/nearby',
          queryParameters: any(named: 'queryParameters'),
        ),
      ).thenAnswer(
        (_) async => Response(
          data: responseData,
          statusCode: 200,
          requestOptions: RequestOptions(path: '/shops/nearby'),
        ),
      );

      // Act
      final result = await repository.getNearby(lat: 41.0, lng: 29.0);

      // Assert
      expect(result.isSuccess, true);
      expect(result.data!.length, 1);
      expect(result.data![0].name, 'Test Shop');
    });

    test('getNearby returns Failure on DioException', () async {
      // Arrange
      when(
        () => mockDio.get(
          '/shops/nearby',
          queryParameters: any(named: 'queryParameters'),
        ),
      ).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/shops/nearby'),
          message: 'Network Error',
          type: DioExceptionType.connectionError,
        ),
      );

      // Act
      final result = await repository.getNearby(lat: 41.0, lng: 29.0);

      // Assert
      expect(result.isFailure, true);
      expect(result.error, contains('Network Error'));
    });

    test('getById returns Success on 200', () async {
      // Arrange
      final responseData = {
        'id': '1',
        'name': 'Detail Shop',
        'address': 'Detail Address',
        'latitude': 41.0,
        'longitude': 29.0,
        'pricePerDay': 50.0,
        'rating': 4.8,
        'isActive': true,
        'capacity': 10,
        'security': 'high',
        'amenities': [],
        'workingHours': {},
      };

      when(() => mockDio.get('/shops/1')).thenAnswer(
        (_) async => Response(
          data: responseData,
          statusCode: 200,
          requestOptions: RequestOptions(path: '/shops/1'),
        ),
      );

      // Act
      final result = await repository.getById('1');

      // Assert
      expect(result.isSuccess, true);
      expect(result.data!.name, 'Detail Shop');
    });
  });
}

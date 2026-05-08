import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/models/shop.dart';
import '../api/api_client.dart';
import '../utils/result.dart';

/// Centralized shop data access — eliminates direct Dio calls from UI screens.
final shopRepositoryProvider = Provider<ShopRepository>((ref) {
  return ShopRepository(ref.watch(dioProvider));
});

class ShopRepository {
  final Dio _dio;
  ShopRepository(this._dio);

  Future<Result<ShopDto>> getById(String id) async {
    try {
      final res = await _dio.get('/shops/$id');
      return Success(ShopDto.fromJson(res.data as Map<String, dynamic>));
    } on DioException catch (e) {
      return Failure(e.message ?? 'Unknown error', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }

  Future<Result<List<ShopDto>>> getNearby({
    required double lat,
    required double lng,
    int radius = 5000,
  }) async {
    try {
      final res = await _dio.get(
        '/shops/nearby',
        queryParameters: {'lat': lat, 'lng': lng, 'r': radius},
      );
      final list = res.data as List<dynamic>;
      return Success(
        list.map((e) => ShopDto.fromJson(e as Map<String, dynamic>)).toList(),
      );
    } on DioException catch (e) {
      return Failure(e.message ?? 'Unknown error', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }
}

/// Providers that screens consume.
final shopProvider = FutureProvider.family<ShopDto, String>((ref, id) async {
  final result = await ref.watch(shopRepositoryProvider).getById(id);
  return result.fold((data) => data, (error) => throw Exception(error));
});

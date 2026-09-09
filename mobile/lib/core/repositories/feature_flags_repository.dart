import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../utils/result.dart';

final featureFlagsRepositoryProvider = Provider<FeatureFlagsRepository>((ref) {
  return FeatureFlagsRepository(ref.watch(dioProvider));
});

class FeatureFlagsRepository {
  final Dio _dio;
  FeatureFlagsRepository(this._dio);

  Future<Result<Map<String, bool>>> getFlags() async {
    try {
      final res = await _dio.get('/feature-flags');
      final raw = (res.data as Map<String, dynamic>)['flags'] as Map;
      return Success(raw.map((k, v) => MapEntry(k as String, v as bool)));
    } on DioException catch (e) {
      return Failure(e.message ?? 'Failed to load feature flags', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }
}

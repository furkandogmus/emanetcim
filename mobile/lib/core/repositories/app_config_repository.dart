import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/models/app_config.dart';
import '../api/api_client.dart';
import '../utils/result.dart';

final appConfigRepositoryProvider = Provider<AppConfigRepository>((ref) {
  return AppConfigRepository(ref.watch(dioProvider));
});

class AppConfigRepository {
  final Dio _dio;
  AppConfigRepository(this._dio);

  Future<Result<AppConfigDto>> getConfig() async {
    try {
      final res = await _dio.get('/config');
      return Success(AppConfigDto.fromJson(res.data as Map<String, dynamic>));
    } on DioException catch (e) {
      return Failure(e.message ?? 'Failed to load app config', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }
}

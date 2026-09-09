import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/models/admin_stats.dart';
import '../api/api_client.dart';
import '../utils/result.dart';

/// Centralized admin data access — eliminates direct Dio calls from UI screens.
final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return AdminRepository(ref.watch(dioProvider));
});

class AdminRepository {
  final Dio _dio;
  AdminRepository(this._dio);

  Future<Result<AdminStatsDto>> getStats() async {
    try {
      final res = await _dio.get('/admin/stats');
      return Success(AdminStatsDto.fromJson(res.data as Map<String, dynamic>));
    } on DioException catch (e) {
      return Failure(e.message ?? 'Unknown error', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }
}

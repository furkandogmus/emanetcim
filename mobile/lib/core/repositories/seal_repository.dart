import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/models/seal_scan_result.dart';
import '../api/api_client.dart';
import '../utils/result.dart';

final sealRepositoryProvider = Provider<SealRepository>((ref) {
  return SealRepository(ref.watch(dioProvider));
});

class SealRepository {
  final Dio _dio;
  SealRepository(this._dio);

  Future<Result<SealScanResult>> scan(String code) async {
    try {
      final res = await _dio.post('/seals/scan', data: {'code': code});
      return Success(SealScanResult.fromJson(res.data as Map<String, dynamic>));
    } on DioException catch (e) {
      return Failure(e.message ?? 'Scan failed', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }
}

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../utils/result.dart';

/// Davet (referans) kodu erisimi. Kural sunucuda (`ReferralService`): misafir
/// kodu, ilk rezervasyon, kuponla birlikte degil. Oran da sunucudan gelir --
/// 2026-09-23'e kadar ekran "her davet icin ₺20" diye sabit yaziyordu ve
/// kodu olmayan kullaniciya var olmayan `BP-WELCOME` kodunu gosteriyordu.
final referralRepositoryProvider = Provider<ReferralRepository>((ref) {
  return ReferralRepository(ref.watch(dioProvider));
});

class ReferralInfo {
  const ReferralInfo({required this.code, required this.discountPct});
  final String code;
  final double discountPct;
}

class ReferralValidation {
  const ReferralValidation({
    required this.valid,
    this.discountPct = 0,
    this.reason,
  });
  final bool valid;
  final double discountPct;

  /// `invalid_code` | `own_code` | `not_first_booking`
  final String? reason;
}

class ReferralRepository {
  ReferralRepository(this._dio);
  final Dio _dio;

  /// Kullanicinin paylasacagi kod; sunucu yoksa uretir.
  Future<Result<ReferralInfo>> getMyCode() async {
    try {
      final res = await _dio.get('/referrals/code');
      final data = res.data as Map<String, dynamic>;
      return Success(
        ReferralInfo(
          code: data['code'] as String,
          discountPct: (data['discountPct'] as num? ?? 0).toDouble(),
        ),
      );
    } on DioException catch (e) {
      return Failure(e.message ?? 'Unknown error', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }

  Future<Result<ReferralValidation>> validate(String code) async {
    try {
      final res = await _dio.post('/referrals/validate', data: {'code': code});
      final data = res.data as Map<String, dynamic>;
      final valid = data['valid'] == true;
      return Success(
        ReferralValidation(
          valid: valid,
          discountPct: (data['discountPct'] as num? ?? 0).toDouble(),
          reason: valid ? null : (data['error'] as String? ?? 'invalid_code'),
        ),
      );
    } on DioException catch (e) {
      return Failure(e.message ?? 'Unknown error', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }
}

final myReferralProvider = FutureProvider<ReferralInfo>((ref) async {
  final result = await ref.watch(referralRepositoryProvider).getMyCode();
  return result.fold((data) => data, (error) => throw Exception(error));
});

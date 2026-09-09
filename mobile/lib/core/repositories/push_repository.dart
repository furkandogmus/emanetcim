import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/models/mobile_device.dart';
import '../api/api_client.dart';
import '../utils/result.dart';

/// "Bildirim alan cihazlar" ekranı — `push_service.dart` yalnızca FCM
/// kaydını yönetir, listeleme/kaldırma bilinçli olarak burada: ikisi
/// farklı yaşam döngüsüne sahip (biri arka planda sessizce çalışır, biri
/// kullanıcı etkileşimiyle tetiklenir).
final pushRepositoryProvider = Provider<PushRepository>((ref) {
  return PushRepository(ref.watch(dioProvider));
});

class PushRepository {
  final Dio _dio;
  PushRepository(this._dio);

  Future<Result<List<MobileDeviceDto>>> getDevices() async {
    try {
      final res = await _dio.get('/push/register');
      final items = (res.data as Map<String, dynamic>)['items'] as List;
      return Success(
        items
            .map((e) => MobileDeviceDto.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
    } on DioException catch (e) {
      return Failure(e.message ?? 'Failed to load devices', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }

  Future<Result<void>> removeDevice(String token) async {
    try {
      await _dio.delete('/push/register', data: {'token': token});
      return const Success<void>(null);
    } on DioException catch (e) {
      return Failure(e.message ?? 'Failed to remove device', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }
}

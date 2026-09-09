import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../utils/result.dart';

/// Adres/yer arama icin Photon (Komoot) servisine konusan ayri Dio istemcisi.
///
/// KASITLI ISTISNA (MM-M2): diger repository'lerin (`shop_repository.dart`,
/// `booking_repository.dart`) tasidigi `dioProvider` bizim backend'imize
/// (`Env.apiBaseUrl`) konusur -- token yenileme, SSL pinning ve kendi taban
/// URL'sini tasir. Bu repository ise ucuncu parti, herkese acik bir arama
/// servisine (`photon.komoot.io`) baglanir: ne bizim token'imiza ne
/// pinning'imize ihtiyaci var, ustelik oneri listesi UI'yi bloklamamali diye
/// kisa (5sn) bir timeout istiyor. O yuzden kendi kucuk `Dio` istemcisini
/// tasir -- ama DI ve donus tipi (`Provider` + `Result<T>`) diger
/// repository'lerle birebir ayni sekle uyar.
final geocodingRepositoryProvider = Provider<GeocodingRepository>((ref) {
  final dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 5),
    ),
  );
  return GeocodingRepository(dio);
});

class GeocodingRepository {
  final Dio _dio;

  GeocodingRepository(this._dio);

  Future<Result<List<dynamic>>> searchPlaces(String query) async {
    try {
      final res = await _dio.get(
        'https://photon.komoot.io/api/',
        queryParameters: {'q': query, 'limit': 5},
        options: Options(
          headers: {'User-Agent': 'BagajPark (contact@bagajpark.com)'},
        ),
      );
      final features = res.data['features'] as List<dynamic>;
      return Success(features);
    } on DioException catch (e) {
      return Failure(e.message ?? 'Geocoding network error', e);
    } catch (e) {
      return Failure(e.toString(), e);
    }
  }
}

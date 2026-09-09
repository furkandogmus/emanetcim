// Regresyon testleri:
// - POST gibi durum değiştiren istekler timeout/5xx'te otomatik yeniden
//   denenmemeli (mükerrer mutasyon riski — bkz. api_client.dart onError).
// - Başarılı bir mutasyon (POST/PUT/DELETE), önbellekteki GET yanıtlarını
//   geçersiz kılmalı (bkz. api_client.dart üçüncü interceptor).
import 'dart:typed_data';

import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/auth/token_store.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Sabit bir erişim jetonu döndüren sahte token deposu — önbellek anahtarı ve
/// Authorization başlığı gerçek koddaki gibi kurulsun diye gerekli.
class _FakeTokenStore extends TokenStore {
  @override
  Future<String?> readAccessToken() async => 'fake-access-token-1234';

  @override
  Future<String?> readRefreshToken() async => null;
}

/// Ağ katmanına hiç çıkmadan [dioProvider]'ın gerçek interceptor zincirini
/// (retry + önbellek dahil) test etmeyi sağlayan sahte HTTP adaptörü.
class _FakeHttpClientAdapter implements HttpClientAdapter {
  _FakeHttpClientAdapter(this._handler);

  final ResponseBody Function(RequestOptions options) _handler;
  final List<String> calls = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls.add('${options.method} ${options.path}');
    return _handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _jsonOk(String body) => ResponseBody.fromString(
  body,
  200,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

Dio _buildDio(_FakeHttpClientAdapter adapter) {
  final container = ProviderContainer(
    overrides: [tokenStoreProvider.overrideWith((ref) => _FakeTokenStore())],
  );
  addTearDown(container.dispose);
  // SslPinning.apply yalnızca release modda etkin olduğundan (bkz.
  // ssl_pinning.dart), test/debug modda adaptörü burada değiştirmek güvenli.
  final dio = container.read(dioProvider)..httpClientAdapter = adapter;
  return dio;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'POST timeout/baglanti hatasinda otomatik yeniden denenmez (idempotent olmayan metod)',
    () async {
      final adapter = _FakeHttpClientAdapter((options) {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.connectionError,
          error: 'baglanti koptu',
        );
      });
      final dio = _buildDio(adapter);

      await expectLater(
        () => dio.post('/bookings/1/check-in', data: {'sealCode': 'X'}),
        throwsA(isA<DioException>()),
      );

      // Yeniden deneme olsaydı bu istek 2 veya 3 kez gönderilirdi (bkz.
      // onError'daki retries<2 döngüsü). Sunucuya ulaşmış-ama-yanıtı-kaybolmuş
      // bir check-in'in ikinci kez tetiklenmemesi gerekiyor.
      expect(adapter.calls, ['POST /bookings/1/check-in']);
    },
  );

  test(
    'basarili mutasyon sonrasi onbellekteki GET yaniti temizlenir',
    () async {
      var getResponses = 0;
      final adapter = _FakeHttpClientAdapter((options) {
        if (options.method == 'GET') {
          getResponses++;
          return _jsonOk('{"call":$getResponses}');
        }
        return _jsonOk('{"ok":true}');
      });
      final dio = _buildDio(adapter);

      final first = await dio.get('/partner/bookings');
      expect(first.data, {'call': 1});

      // Ayni GET tekrar cagrilinca 5 dakikalik onbellekten donmeli — adaptore
      // ikinci kez gidilmemeli.
      final cached = await dio.get('/partner/bookings');
      expect(cached.data, {'call': 1});
      expect(
        adapter.calls.where((c) => c.startsWith('GET')).length,
        1,
        reason: 'ikinci GET onbellekten donmeliydi',
      );

      // Mutasyon (check-in) basariyla tamamlanir.
      await dio.post('/bookings/1/check-in', data: {'sealCode': 'X'});

      // Onbellek temizlendigi icin bir sonraki GET adaptore gitmeli ve taze
      // veri donmeli — check-in sonrasi liste artik bayat olmamali.
      final fresh = await dio.get('/partner/bookings');
      expect(fresh.data, {'call': 2});
      expect(adapter.calls.where((c) => c.startsWith('GET')).length, 2);
    },
  );
}

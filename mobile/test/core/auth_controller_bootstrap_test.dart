// Regresyon testi: uygulama acilisinda /auth/me basarisiz olursa (token
// gecersiz/suresi dolmus), yalnizca token'lar degil kullaniciya ozel Hive
// onbellekleri de temizlenmeli. Aksi halde ayni cihazda sonra giris yapan
// farkli bir kullanici, cevrimdisi bir listeleme aninda onceki kullanicinin
// rezervasyonlarini gorebilir (bkz. auth_controller.dart _bootstrap).
import 'dart:io';
import 'dart:typed_data';

import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/core/auth/token_store.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeTokenStore extends TokenStore {
  bool cleared = false;

  @override
  Future<String?> readAccessToken() async => 'fake-access-token';

  @override
  Future<void> clear() async {
    cleared = true;
  }
}

/// /auth/me icin her zaman 401 donen sahte adaptor.
class _Unauthorized401Adapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString('{"error":"unauthorized"}', 401);

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    tempDir = await Directory.systemTemp.createTemp('hive_bootstrap_test');
    Hive.init(tempDir.path);
    await (await Hive.openBox('my_bookings_cache')).put('list', [
      {'id': 'onceki-kullanicinin-rezervasyonu'},
    ]);
    await (await Hive.openBox('partner_bookings_cache')).put('list', [
      {'id': 'onceki-kullanicinin-esnaf-rezervasyonu'},
    ]);
  });

  tearDown(() async {
    await Hive.deleteFromDisk();
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  test(
    'acilista /auth/me basarisiz olursa my/partner bookings onbellegi temizlenir',
    () async {
      final fakeStore = _FakeTokenStore();
      final container = ProviderContainer(
        overrides: [
          tokenStoreProvider.overrideWith((ref) => fakeStore),
          dioProvider.overrideWith((ref) {
            final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'))
              ..httpClientAdapter = _Unauthorized401Adapter();
            return dio;
          }),
        ],
      );
      addTearDown(container.dispose);

      container.read(
        authControllerProvider,
      ); // build() -> _bootstrap tetiklenir
      // _bootstrap icindeki await zincirinin (SharedPreferences, token okuma,
      // basarisiz /auth/me cagrisi, temizlik) tamamlanmasini bekle.
      //
      // SABIT GECIKME YERINE YOKLAMA (2026-09-10'da CI'da gorulen flake
      // sonrasi): CI runner'i paylasimli/yuklu olabiliyor ve sabit 50ms
      // bazen SharedPreferences + mock HTTP + token temizligi zincirinin
      // tamamlanmasi icin yetmiyordu -- yerelde hep gecen test CI'da ara
      // sira "Expected: true, Actual: false" ile dusuyordu. Kosul
      // gerceklesir gerceklesmez cikan bir yoklama dongusu, hem yerelde
      // yavaslatmiyor hem CI'da payli zaman taniyor.
      final deadline = DateTime.now().add(const Duration(seconds: 5));
      while (!fakeStore.cleared && DateTime.now().isBefore(deadline)) {
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }

      expect(fakeStore.cleared, isTrue);
      expect(Hive.box('my_bookings_cache').get('list'), isNull);
      expect(Hive.box('partner_bookings_cache').get('list'), isNull);
    },
  );
}

import 'dart:io';
import 'dart:typed_data';

import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/core/auth/token_store.dart';
import 'package:bagajpark/core/sync/sync_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce/hive.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// `readAccessToken()` `null` doner: AuthController._bootstrap() bu yuzden
/// session'i hic doldurmaz, testteki tek session degisikligi
/// `completeSession(...)` cagrisindan gelir.
class _FakeTokenStore extends TokenStore {
  @override
  Future<String?> readAccessToken() async => null;
  @override
  Future<void> save({required String access, required String refresh}) async {}
  @override
  Future<void> clear() async {}
}

/// Gercek agi hic tetiklemeden her istegi 200 ile yanitlayan sahte adapter.
class _FakeSuccessAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      '{}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    tempDir = await Directory.systemTemp.createTemp('sync_service_test');
    Hive.init(tempDir.path);
    await Hive.openBox('pending_sync_actions');
  });

  tearDown(() async {
    await Hive.close();
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('SyncService Tests', () {
    test(
      'oturum acilinca (session null -> dolu) bekleyen offline eylem otomatik '
      'senkronize edilir; oncesinde acilistaki TEK SEFERLIK sync() cagrisi auth '
      'bootstrap henuz bitmedigi icin daima no-op donuyor, ve baglanti zaten '
      'acikken (degismedigi icin) hicbir baska tetikleyici calismiyordu',
      () async {
        final box = Hive.box('pending_sync_actions');
        await box.put('a1', {
          'id': 'a1',
          'userId': 'u1',
          'type': 0,
          'bookingId': 'b1',
          'data': null,
          'timestamp': DateTime.now().toIso8601String(),
        });

        final dio = Dio()..httpClientAdapter = _FakeSuccessAdapter();

        final container = ProviderContainer(
          overrides: [
            tokenStoreProvider.overrideWith((ref) => _FakeTokenStore()),
            dioProvider.overrideWith((ref) => dio),
          ],
        );
        addTearDown(container.dispose);

        // app.dart'taki eager-read'i simule ediyoruz: SyncService.init()
        // burada calisir ve authControllerProvider dinleyicisini kurar.
        container.read(syncServiceProvider);

        // Auth henuz bootstrap olmadi (session null); bekleyen eylem hala kutuda.
        expect(box.containsKey('a1'), true);

        // Oturum acildi (login / bootstrap tamamlandi -> session null'dan dolu
        // hale gecti).
        await container.read(authControllerProvider.notifier).completeSession({
          'accessToken': 'tok',
          'refreshToken': 'ref',
          'user': {'id': 'u1', 'role': 'GUEST'},
        });

        // SyncService'in authControllerProvider dinleyicisi sync()'i tetikler;
        // bu fire-and-forget oldugu icin ag cagrisi + kutu temizliginin
        // tamamlanmasini bekle.
        await Future<void>.delayed(const Duration(milliseconds: 100));

        expect(box.containsKey('a1'), false);
      },
    );
  });
}

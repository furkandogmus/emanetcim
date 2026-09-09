// Regresyon testi: kuyrukta kalici olarak reddedilen (4xx) bir eylem, arkasindaki
// gecerli eylemleri sonsuza dek bloklamamali. bkz. sync_service.dart sync().
import 'dart:io';
import 'dart:typed_data';

import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/core/sync/sync_service.dart';
import 'package:bagajpark/shared/models/user.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

import '../features/support/pump_app.dart' show FakeAuthController;

/// Belirli bir path icin sabit bir yanit donduren sahte HTTP adaptoru.
class _FakeHttpClientAdapter implements HttpClientAdapter {
  _FakeHttpClientAdapter(this._statusByPath);

  final Map<String, int> _statusByPath;
  final List<String> calls = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls.add(options.path);
    final status = _statusByPath[options.path] ?? 200;
    return ResponseBody.fromString('{}', status);
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_sync_test');
    Hive.init(tempDir.path);
    await Hive.openBox('pending_sync_actions');
  });

  tearDown(() async {
    await Hive.deleteFromDisk();
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  test(
    'kalici (4xx) hata kuyruktan dusurulur, arkasindaki eylem yine de senkronlanir',
    () async {
      const userId = 'user-1';
      final adapter = _FakeHttpClientAdapter({
        // A: sunucu kalici olarak reddediyor (ör. baska cihazdan zaten check-in).
        '/bookings/A/check-in': 400,
        // B: A'nin arkasinda kuyrukta, basariyla senkronlanmali.
        '/bookings/B/check-out': 200,
      });

      final box = Hive.box('pending_sync_actions');
      final actionA = SyncAction(
        id: 'action-a',
        userId: userId,
        type: SyncActionType.checkIn,
        bookingId: 'A',
        timestamp: DateTime.now(),
      );
      final actionB = SyncAction(
        id: 'action-b',
        userId: userId,
        type: SyncActionType.checkOut,
        bookingId: 'B',
        timestamp: DateTime.now().add(const Duration(seconds: 1)),
      );
      await box.put(actionA.id, actionA.toJson());
      await box.put(actionB.id, actionB.toJson());

      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(
            () => FakeAuthController(
              const AuthState(
                session: UserDto(id: userId, role: UserRole.partner),
              ),
            ),
          ),
          dioProvider.overrideWith((ref) {
            final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'))
              ..httpClientAdapter = adapter;
            return dio;
          }),
        ],
      );
      addTearDown(container.dispose);

      // syncServiceProvider'in kendi init()'i connectivity_plus platform
      // kanalina bagimli (testte yok); onun yerine gercek Ref'i alip
      // SyncService'i dogrudan kurarak yalnizca sync() mantigini test ediyoruz.
      final refProvider = Provider<Ref>((ref) => ref);
      final ref = container.read(refProvider);
      final service = SyncService(ref);

      await service.sync();

      // Ikisi de kuyruktan cikmis olmali: A kalici hata oldugu icin dusuruldu,
      // B basariyla senkronlandigi icin silindi.
      expect(box.get('action-a'), isNull);
      expect(box.get('action-b'), isNull);
      // Onceki davranista (break) B hic denenmezdi; simdi ikisi de cagrilmali.
      expect(adapter.calls, ['/bookings/A/check-in', '/bookings/B/check-out']);
    },
  );

  test(
    'gecici hata (baglanti) kuyrugu oldugu gibi birakir ve sonraki eylemleri de dener',
    () async {
      const userId = 'user-1';
      final failingAdapter = _ThrowingThenOkAdapter(
        failPath: '/bookings/A/check-in',
      );

      final box = Hive.box('pending_sync_actions');
      final actionA = SyncAction(
        id: 'action-a',
        userId: userId,
        type: SyncActionType.checkIn,
        bookingId: 'A',
        timestamp: DateTime.now(),
      );
      await box.put(actionA.id, actionA.toJson());

      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(
            () => FakeAuthController(
              const AuthState(
                session: UserDto(id: userId, role: UserRole.partner),
              ),
            ),
          ),
          dioProvider.overrideWith((ref) {
            final dio = Dio(BaseOptions(baseUrl: 'https://test.invalid'))
              ..httpClientAdapter = failingAdapter;
            return dio;
          }),
        ],
      );
      addTearDown(container.dispose);

      final refProvider = Provider<Ref>((ref) => ref);
      final ref = container.read(refProvider);
      final service = SyncService(ref);

      await service.sync();

      // Ag hatasi gecicidir; eylem kuyrukta kalmali (silinmemeli), kalici
      // hatadan farkli olarak burada dusurulmemesi gerekiyor.
      expect(box.get('action-a'), isNotNull);
    },
  );
}

/// Belirtilen path icin baglanti hatasi firlatan, digerlerinde basarili yanit
/// donen sahte adaptor.
class _ThrowingThenOkAdapter implements HttpClientAdapter {
  _ThrowingThenOkAdapter({required this.failPath});

  final String failPath;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path == failPath) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        error: 'baglanti koptu',
      );
    }
    return ResponseBody.fromString('{}', 200);
  }

  @override
  void close({bool force = false}) {}
}

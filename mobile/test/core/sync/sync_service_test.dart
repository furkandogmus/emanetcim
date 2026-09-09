// Regresyonlar (mobile/lib/core/sync/sync_service.dart):
//  1. `sync()`, bir aksiyonda basarisiz olunca `break` ile TUM dongyu
//     durduruyordu -- kalici olarak basarisiz (4xx) tek bir aksiyon, ayni
//     kullanicinin sirada bekleyen FARKLI bookinglere ait aksiyonlarini
//     sonsuza dek bloklardi.
//  2. `addAction`, ayni booking+type icin zaten bekleyen bir aksiyon olup
//     olmadigini kontrol etmiyordu -- esnaf senkronize olmadan ayni
//     aksiyonu iki kez tetiklerse, baglanti geri geldiginde backend'e iki
//     istek art arda gidiyordu.
import 'dart:io';

import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/core/sync/sync_service.dart';
import 'package:bagajpark/shared/models/user.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

class _FixedAuthController extends AuthController {
  _FixedAuthController(this._initial);
  final AuthState _initial;

  @override
  AuthState build() => _initial;
}

const _partnerSession = UserDto(id: 'user-1', role: UserRole.partner);

// `syncServiceProvider`, olusturulunca `SyncService.init()`'i cagirir; o da
// `connectivity_plus`'in EventChannel'ini dinlemeye calisir. Bu paket
// platform kanali gerektirir ve widget testlerinde mevcut degildir (bkz.
// `test/features/support/pump_app.dart`'taki `FakeAuthController` yorumu).
// Bu yuzden burada `SyncService`'i provider'i UZERINDEN degil, dogrudan
// (`init()` cagirmadan) kuruyoruz -- test ettigimiz `addAction`/`sync`
// davranisi zaten baglanti dinleyicisine bagli degil.
final _refProvider = Provider<Ref>((ref) => ref);

void main() {
  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('sync_service_test');
    Hive.init(tempDir.path);
    await Hive.openBox('pending_sync_actions');
  });

  tearDown(() async {
    await Hive.deleteFromDisk();
    if (tempDir.existsSync()) {
      tempDir.deleteSync(recursive: true);
    }
  });

  SyncService makeService(Dio dio) {
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(
          () => _FixedAuthController(const AuthState(session: _partnerSession)),
        ),
        dioProvider.overrideWith((ref) => dio),
      ],
    );
    addTearDown(container.dispose);
    return SyncService(container.read(_refProvider));
  }

  test('kalici basarisiz (4xx) bir aksiyon diger bookinglere ait aksiyonlarin '
      'senkronizasyonunu engellemez', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://test.local'));
    final calledPaths = <String>[];
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          calledPaths.add(options.path);
          if (options.path == '/bookings/a-permanently-rejected/check-in') {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response(requestOptions: options, statusCode: 409),
                type: DioExceptionType.badResponse,
              ),
            );
            return;
          }
          handler.resolve(Response(requestOptions: options, statusCode: 200));
        },
      ),
    );

    final service = makeService(dio);

    // A once kuyruga girer (kalici basarisiz olacak), sonra farkli bir
    // booking icin B (basarili olacak).
    await service.addAction(SyncActionType.checkIn, 'a-permanently-rejected');
    await service.addAction(SyncActionType.checkOut, 'b-should-still-sync');

    // `addAction` her cagrida `sync()`'i tetikliyor (unawaited); bu
    // fire-and-forget cagrilarin tamamlanmasini bekliyoruz, sonra acikca
    // bir kez daha cagiriyoruz ki (henuz senkronize olmamis bir sey kaldiysa)
    // calisma sirasi test icinde deterministik olsun.
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await service.sync();

    expect(
      calledPaths,
      containsAll(<String>[
        '/bookings/a-permanently-rejected/check-in',
        '/bookings/b-should-still-sync/check-out',
      ]),
    );

    final remaining = service.pendingActions;
    expect(
      remaining.any((a) => a.bookingId == 'b-should-still-sync'),
      isFalse,
      reason: 'B basariyla senkronize oldu, kuyrukta kalmamali.',
    );
    expect(
      remaining.any((a) => a.bookingId == 'a-permanently-rejected'),
      isFalse,
      reason:
          'A kalici olarak reddedildi (409); tekrar denemek sonucu '
          'degistirmeyecegi icin kuyruktan cikarilmali.',
    );
  });

  test('ayni booking+type icin zaten bekleyen bir aksiyon varsa yenisi '
      'kuyruga eklenmez', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://test.local'));
    // Istek kasitli olarak HIC cozulmuyor (`handler` hic cagrilmiyor) --
    // ilk `addAction`'in tetikledigi `sync()` boylece sonsuza dek "devam
    // ediyor" durumunda kalir, aksiyon kuyruktan hic silinmez ve dedup
    // davranisini zamanlamaya bagli olmadan (aksiyonun kendi kendine
    // senkronize olup kuyruktan cikma ihtimali olmadan) gozlemleyebiliriz.
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {}));

    final service = makeService(dio);

    await service.addAction(SyncActionType.checkIn, 'booking-x');
    await service.addAction(SyncActionType.checkIn, 'booking-x');
    await service.addAction(SyncActionType.checkIn, 'booking-x');

    final pending = service.pendingActions.where(
      (a) => a.bookingId == 'booking-x' && a.type == SyncActionType.checkIn,
    );
    expect(
      pending.length,
      1,
      reason:
          'Ayni booking+type icin ikinci/ucuncu addAction cagrisi, '
          "backend'e iki kez check-in istegi gondermemesi icin no-op "
          'olmali.',
    );
  });
}

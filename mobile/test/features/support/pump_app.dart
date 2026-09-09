// Ortak widget test kurulumu.
//
// `mobile/lib/main.dart` uygulamayı EasyLocalization > ProviderScope >
// MaterialApp.router sırasıyla kuruyor; bu dosya aynı sırayı testler için
// yeniden üretir. Mevcut widget testleri (bkz.
// `test/features/search/shop_preview_card_test.dart`, `test/widget_test.dart`)
// yalın `ProviderScope(child: MaterialApp(...))` kullanıyordu — `.tr()`
// (easy_localization) veya `context.go/push` (go_router) çağıran ekranlar
// için bu yeterli değil, o yüzden gerçek EasyLocalization + GoRouter kurulumu
// gerekiyor.
//
// `TK-H1` kapsamında test edilen ekranların çoğu `ref.read(dioProvider)` ile
// doğrudan I/O yapıyor (servis katmanı yok, ekran kendi Dio çağrısını
// yapıyor) — bu yüzden gerçek ağ/secure-storage'a dokunmadan sabit bir yanıt
// döndüren [fakeDio] burada tanımlı.
import 'dart:convert';

import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// EasyLocalization + ProviderScope + GoRouter ile [child]'ı pump eder.
///
/// `extraRoutes`, ekranın `context.go`/`context.push` ile gittiği hedef
/// yolları küçük birer stub ekranla karşılamak için kullanılır — gerçek
/// GoRouter tablosunu (`lib/app/router.dart`) kurmak yerine, testin ihtiyaç
/// duyduğu rotalar kadarını tanımlarız.
Future<void> pumpApp(
  WidgetTester tester, {
  required Widget child,
  List<Override> overrides = const [],
  Map<String, WidgetBuilder> extraRoutes = const {},
  Map<String, Object> prefs = const {},
}) async {
  SharedPreferences.setMockInitialValues(prefs);
  await EasyLocalization.ensureInitialized();

  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (context, state) => child),
      for (final entry in extraRoutes.entries)
        GoRoute(
          path: entry.key,
          builder: (context, state) => entry.value(context),
        ),
    ],
  );

  await tester.pumpWidget(
    EasyLocalization(
      supportedLocales: const [Locale('tr'), Locale('en')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('tr'),
      // Test ortaminin platform locale'i (genelde en_US) `supportedLocales`
      // icinde oldugu icin `fallbackLocale` devreye girmiyor ve ekran
      // sessizce Ingilizce ceviriyle render oluyordu. `startLocale` ile
      // uygulamanin gercek varsayilanini (tr) test'te de sabitliyoruz.
      startLocale: const Locale('tr'),
      // Varsayılan `RootBundleAssetLoader`, her testte gerçek `rootBundle`
      // disk I/O'suna çıkıyor; bir dosyada birden fazla `testWidgets` her
      // birinde yeni bir `EasyLocalization` mount ettiğinde bu yükleme ilk
      // testte tesadüfen yetişip sonrakilerde hiç tamamlanmıyordu (widget
      // "Load asset" adımında asılı kalıyordu). Çeviri JSON'larını burada
      // BİR KERE gerçek I/O ile okuyup, `AssetLoader`'ı önceden yüklenmiş bu
      // veriyi anında döndürecek şekilde değiştiriyoruz — böylece her testte
      // tekrar disk I/O'suna girilmiyor.
      assetLoader: await _preloadedAssetLoader(),
      child: ProviderScope(
        overrides: overrides,
        child: Builder(
          builder: (context) => MaterialApp.router(
            routerConfig: router,
            locale: context.locale,
            supportedLocales: context.supportedLocales,
            localizationsDelegates: context.localizationDelegates,
          ),
        ),
      ),
    ),
  );

  suppressPendingGoogleFontsErrors();

  // Ceviriler artik onceden yuklenmis oldugundan tek bir pump asenkron
  // bosluklari (delegate init, ilk build) kapatmaya yetiyor; yine de
  // guvenlik icin birkac kere pump ediyoruz.
  await tester.pump();
  await tester.pump();
  suppressPendingGoogleFontsErrors();
}

Map<String, dynamic>? _cachedTrTranslations;
Map<String, dynamic>? _cachedEnTranslations;

Future<AssetLoader> _preloadedAssetLoader() async {
  _cachedTrTranslations ??=
      json.decode(await rootBundle.loadString('assets/l10n/tr.json'))
          as Map<String, dynamic>;
  _cachedEnTranslations ??=
      json.decode(await rootBundle.loadString('assets/l10n/en.json'))
          as Map<String, dynamic>;
  return _PreloadedAssetLoader(
    tr: _cachedTrTranslations!,
    en: _cachedEnTranslations!,
  );
}

class _PreloadedAssetLoader extends AssetLoader {
  const _PreloadedAssetLoader({required this.tr, required this.en});

  final Map<String, dynamic> tr;
  final Map<String, dynamic> en;

  @override
  Future<Map<String, dynamic>> load(String path, Locale locale) async {
    return locale.languageCode == 'en' ? en : tr;
  }
}

/// `GoogleFonts.outfit(...)` gibi çağrılar, eksik bir yazı tipini arka planda
/// (fire-and-forget) ağdan indirmeyi dener. Test ortamında ağ yok — ve olsa
/// da testin ağa bağımlı olmaması gerekir — bu indirme denemesi başarısız
/// olunca fırlatılan hata hiçbir yerde `await` edilmediği için "yakalanmamış"
/// (unhandled) sayılıp ilgisiz testleri kırıyordu. `runAsync` çağrılmadan
/// önce bu bekleyen future'lara sessiz bir `catchError` ekleyerek bunu önlüyoruz.
void suppressPendingGoogleFontsErrors() {
  // ignore: unawaited_futures
  GoogleFonts.pendingFonts().catchError((Object _) => const <void>[]);
}

/// Gerçek ağ/secure-storage'a dokunmadan sabit bir yanıt döndüren [Dio].
///
/// Ekranlar `dioProvider`'ı bir servis katmanı üzerinden değil doğrudan
/// `ref.read(dioProvider)` ile kullandığından (bkz. `partner_earnings_screen.dart`,
/// `admin_applications_screen.dart`, `profile_screen.dart`), gerçekçi bir HTTP
/// adaptörü yazmak yerine istek daha gönderilmeden interceptor seviyesinde
/// kesilip yanıt doğrudan çözülüyor.
Dio fakeDio(
  dynamic Function(RequestOptions options) responder, {
  int statusCode = 200,
}) {
  final dio = Dio(BaseOptions(baseUrl: 'https://test.local'));
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        handler.resolve(
          Response(
            requestOptions: options,
            data: responder(options),
            statusCode: statusCode,
          ),
        );
      },
    ),
  );
  return dio;
}

/// `authControllerProvider`'ı gerçek `_bootstrap()` (SharedPreferences +
/// flutter_secure_storage + ağ) çalıştırmadan sabit bir [AuthState] ile
/// başlatan sahte controller.
///
/// `logout()` ve `setOnboardingDone()` de override edilir; aksi halde gerçek
/// implementasyon `tokenStoreProvider` (flutter_secure_storage) ve Hive
/// kutularına dokunur — widget testinde platform kanalı olmadığı için bunlar
/// mevcut değildir.
class FakeAuthController extends AuthController {
  FakeAuthController(this._initial);

  final AuthState _initial;

  @override
  AuthState build() => _initial;

  @override
  Future<void> logout() async {
    state = state.copyWith(clearSession: true, loading: false);
  }

  @override
  Future<void> setOnboardingDone() async {
    state = state.copyWith(onboardingDone: true);
  }
}

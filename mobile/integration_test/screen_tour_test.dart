// Ekran turu: gercek cihazda uygulamayi acar, uc rolle (misafir/esnaf/admin) giris yapar,
// ulasilabilir her rotaya gider ve ekran goruntusu alir. Calistirma: scripts/screen-tour.sh
//
// Bu bir davranis testi DEGIL; amaci gorsel inceleme icin kanit uretmek. Ekranlardan
// firlayan istisnalar testi durdurmaz, sonda ozet olarak basilir (takeException).
import 'package:bagajpark/app/app.dart';
import 'package:bagajpark/app/router.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/main.dart' as app;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

const _password = String.fromEnvironment('E2E_PASSWORD');
const _shopId = String.fromEnvironment('E2E_SHOP_ID');
const _guestBookingId = String.fromEnvironment('E2E_GUEST_BOOKING_ID');
const _partnerBookingId = String.fromEnvironment('E2E_PARTNER_BOOKING_ID');
const _roles = String.fromEnvironment(
  'E2E_ROLES',
  defaultValue: 'guest,partner,admin',
);

const _accounts = {
  'guest': 'misafir@test.com',
  'partner': 'esnaf@test.com',
  'admin': 'admin@test.com',
};

/// Rol -> gezilecek rotalar. Parametreli rotalar dart-define ile gelen id'leri kullanir;
/// id bos gelirse o rota atlanir.
List<String> _routesFor(String role) => switch (role) {
  'guest' => [
    '/',
    '/search',
    '/bookings',
    '/notifications',
    '/profile',
    if (_shopId.isNotEmpty) '/shop/$_shopId',
    if (_shopId.isNotEmpty) '/checkout/$_shopId',
    if (_guestBookingId.isNotEmpty) '/booking/$_guestBookingId',
  ],
  'partner' => [
    '/partner',
    if (_partnerBookingId.isNotEmpty) '/partner/booking/$_partnerBookingId',
    '/partner/earnings',
    '/partner/settings',
    '/partner/seals',
    '/partner/scan',
    '/notifications',
    '/profile',
  ],
  'admin' => ['/admin', '/admin/applications', '/admin/messages', '/profile'],
  _ => const [],
};

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  final problems = <String>[];

  /// Sonsuz animasyonlar (shimmer, progress) pumpAndSettle'i asla bitirmez; sabit sureyle
  /// birkac kare pump edip ag yanitina zaman taniyoruz.
  Future<void> settle(WidgetTester tester, {int seconds = 3}) async {
    for (var i = 0; i < seconds * 4; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
  }

  Future<void> shot(WidgetTester tester, String name) async {
    await settle(tester);
    final err = tester.takeException();
    if (err != null) {
      problems.add('$name: $err');
    }
    await binding.takeScreenshot(name);
  }

  ProviderContainer container(WidgetTester tester) =>
      ProviderScope.containerOf(tester.element(find.byType(BagajParkApp)));

  Future<void> login(WidgetTester tester, String email) async {
    final fields = find.byType(TextFormField);
    expect(
      fields,
      findsAtLeastNWidgets(2),
      reason: 'login ekraninda iki alan bekleniyor',
    );
    await tester.enterText(fields.at(0), email);
    await tester.enterText(fields.at(1), _password);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await settle(tester, seconds: 6);
  }

  testWidgets('ekran turu', (tester) async {
    expect(_password, isNotEmpty, reason: 'E2E_PASSWORD dart-define bos');
    await app.main();
    await settle(tester, seconds: 4);
    await binding.convertFlutterSurfaceToImage();
    await tester.pump();

    final c = container(tester);
    final auth = c.read(authControllerProvider.notifier);
    final router = c.read(routerProvider);

    // Ilk acilis: onboarding gorunuyorsa fotografla, sonra atla.
    if (!c.read(authControllerProvider).onboardingDone) {
      await shot(tester, '00_onboarding');
      await auth.setOnboardingDone();
      await settle(tester);
    }
    // Onceki turdan oturum kalmis olabilir.
    if (c.read(authControllerProvider).session != null) {
      await auth.logout();
      await settle(tester);
    }
    await shot(tester, '01_auth_login');
    router.go('/auth/register');
    await shot(tester, '02_auth_register');
    router.go('/auth/reset-password-confirm');
    await shot(tester, '03_auth_reset_confirm');
    router.go('/auth/login');
    await settle(tester);

    var order = 10;
    for (final role
        in _roles
            .split(',')
            .map((r) => r.trim())
            .where(_accounts.containsKey)) {
      await login(tester, _accounts[role]!);
      if (c.read(authControllerProvider).session == null) {
        problems.add(
          '$role: giris basarisiz (backend erisilebilir mi, sifre dogru mu?)',
        );
        await shot(tester, '${order}_${role}_login_failed');
        order++;
        continue;
      }
      for (final route in _routesFor(role)) {
        router.go(route);
        final slug = route
            .replaceAll(RegExp('[^a-zA-Z0-9]+'), '_')
            .replaceAll(RegExp('^_|_\$'), '');
        await shot(tester, '${order}_${role}_${slug.isEmpty ? 'home' : slug}');
        order++;
      }
      await auth.logout();
      await settle(tester);
    }

    // Ozet: sorunlar konsola; test yesil kalir, gorsel inceleme insanin isi.
    debugPrint('=== EKRAN TURU OZETI: ${problems.length} sorun ===');
    for (final p in problems) {
      debugPrint(' - $p');
    }
  });
}

import 'package:bagajpark/core/api/api_client.dart';
import 'package:bagajpark/core/auth/auth_controller.dart';
import 'package:bagajpark/features/profile/profile_screen.dart';
import 'package:bagajpark/shared/models/user.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:network_image_mock/network_image_mock.dart';

import '../support/pump_app.dart';

void main() {
  const guest = UserDto(
    id: 'user-1',
    role: UserRole.guest,
    name: 'Ayse Yilmaz',
    email: 'ayse@example.com',
  );

  const partner = UserDto(
    id: 'user-2',
    role: UserRole.partner,
    name: 'Mehmet Esnaf',
    email: 'mehmet@example.com',
  );

  Future<void> pumpProfile(
    WidgetTester tester, {
    required FakeAuthController controller,
  }) async {
    await mockNetworkImagesFor(
      () => pumpApp(
        tester,
        child: const ProfileScreen(),
        overrides: [
          authControllerProvider.overrideWith(() => controller),
          dioProvider.overrideWith(
            (ref) => fakeDio((options) {
              expect(options.path, '/profile/stats');
              return {
                'totalBookings': 5,
                'totalSavings': 120,
                'completedBookings': 3,
              };
            }),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('misafir kullanici bilgilerini ve istatistiklerini gosterir', (
    tester,
  ) async {
    await mockNetworkImagesFor(() async {
      await pumpProfile(
        tester,
        controller: FakeAuthController(const AuthState(session: guest)),
      );

      expect(find.text('Hesabım'), findsOneWidget);
      expect(find.text('Ayse Yilmaz'), findsOneWidget);
      expect(find.text('ayse@example.com'), findsOneWidget);
      expect(find.text('5'), findsOneWidget); // totalBookings
      expect(find.text('3'), findsOneWidget); // completedBookings
      expect(find.text('₺120'), findsOneWidget); // totalSavings

      // Misafir icin davet karti gorunur, esnaf-only menuler gorunmez.
      expect(find.text('Arkadaşlarını Davet Et'), findsOneWidget);
      expect(find.text('Kazançlarım'), findsNothing);
      expect(find.text('Dükkan Ayarları'), findsNothing);
    });
  });

  testWidgets('esnaf kullanicida esnaf yonetimi menusu gorunur', (
    tester,
  ) async {
    await mockNetworkImagesFor(() async {
      await pumpProfile(
        tester,
        controller: FakeAuthController(const AuthState(session: partner)),
      );

      expect(find.text('Mehmet Esnaf'), findsOneWidget);
      expect(find.text('Kazançlarım'), findsOneWidget);
      expect(find.text('Dükkan Ayarları'), findsOneWidget);
      // Esnaf icin davet karti gizli.
      expect(find.text('Arkadaşlarını Davet Et'), findsNothing);
    });
  });

  testWidgets('cikis yap onayi oturumu kapatir, vazgec onayi oturumu korur', (
    tester,
  ) async {
    await mockNetworkImagesFor(() async {
      final controller = FakeAuthController(const AuthState(session: guest));
      await pumpProfile(tester, controller: controller);

      // `dragUntilVisible` sadece widget'i agaca ekliyor, tam viewport
      // icine ortalamiyor — ekstra bir kaydirma ile gercekten dokunulabilir
      // hale getiriyoruz.
      await tester.dragUntilVisible(
        find.text('Çıkış Yap'),
        find.byType(Scrollable).first,
        const Offset(0, -200),
      );
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -150));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Çıkış Yap').first);
      await tester.pumpAndSettle();

      // Onay yuzeyi (widget tipinden bagimsiz — ConfirmDialog'a
      // tasinmasi ihtimaline karsi metne gore dogruluyoruz).
      expect(
        find.text('Hesabınızdan çıkış yapmak istediğinize emin misiniz?'),
        findsOneWidget,
      );

      // Once vazgec: oturum hala acik kalmali.
      await tester.tap(find.text('İptal'));
      await tester.pumpAndSettle();
      expect(controller.state.session, isNotNull);

      // Simdi gercekten cikis yap.
      await tester.tap(find.text('Çıkış Yap').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Çıkış Yap').last);
      await tester.pumpAndSettle();

      expect(controller.state.session, isNull);
    });
  });

  testWidgets(
    'bildirim tercihleri sheet: switch dokunulunca canli guncellenir',
    (tester) async {
      // Varsayilan test yuzeyi (800x600 mantiksal) ve hatta normal bir
      // telefon boyu bile, `showModalBottomSheet` `isScrollControlled: true`
      // OLMADAN sheet'i ekranin ~9/16'siyla sinirladigindan uc
      // SwitchListTile'i sigdiramiyor (bu, ekranin kendi mevcut davranisi --
      // bu bulgunun kapsami disinda, dokunulmuyor). Test, gorunum
      // tasmasiyla degil davranisla ilgilensin diye yuzeyi bolca genisletiyoruz.
      tester.view.physicalSize = const Size(1170, 5400);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(tester.view.reset);

      await mockNetworkImagesFor(() async {
        final controller = FakeAuthController(const AuthState(session: guest));
        await pumpProfile(tester, controller: controller);

        await tester.dragUntilVisible(
          find.text('Bildirimler'),
          find.byType(Scrollable).first,
          const Offset(0, -200),
        );
        await tester.tap(find.text('Bildirimler'));
        await tester.pumpAndSettle();

        final promoSwitch = find.widgetWithText(
          SwitchListTile,
          'Kampanya & İndirim',
        );
        expect(promoSwitch, findsOneWidget);
        expect(tester.widget<SwitchListTile>(promoSwitch).value, isTrue);

        await tester.tap(promoSwitch);
        await tester.pumpAndSettle();

        // Onceden sheet icindeki uc SwitchListTile, sheet acilmadan hemen
        // once `ref.read` ile alinan sabit bir kopyaya bagliydi; hicbir
        // yerde `ref.watch` olmadigindan Riverpod hicbir elementi yeniden
        // cizmeye zorlamiyor ve kullanici dokunsa da anahtar sheet
        // kapanana kadar gorsel olarak degismiyordu (2026-09-09'da
        // bulundu).
        expect(tester.widget<SwitchListTile>(promoSwitch).value, isFalse);
      });
    },
  );

  testWidgets('profileStatsProvider autoDispose: sekmeden cikip geri donulunce '
      'istatistikler tazelenir', (tester) async {
    await mockNetworkImagesFor(() async {
      var callCount = 0;
      final controller = FakeAuthController(const AuthState(session: guest));

      await pumpApp(
        tester,
        child: const ProfileScreen(),
        extraRoutes: {'/away': (_) => const SizedBox.shrink()},
        overrides: [
          authControllerProvider.overrideWith(() => controller),
          // ProfileScreen, `/profile/stats` disinda (ornek: feature-flags)
          // baska uclara da istek atabiliyor; sayaci yalnizca aradigimiz
          // uc icin arttiriyoruz, digerlerine bos bir govde donuyoruz.
          dioProvider.overrideWith(
            (ref) => fakeDio((options) {
              if (options.path != '/profile/stats') return <String, dynamic>{};
              callCount++;
              return {
                'totalBookings': callCount,
                'totalSavings': 0,
                'completedBookings': 0,
              };
            }),
          ),
        ],
      );
      await tester.pumpAndSettle();
      expect(callCount, 1);

      final router = GoRouter.of(tester.element(find.byType(ProfileScreen)))
        ..go('/away');
      await tester.pumpAndSettle();
      expect(find.byType(ProfileScreen), findsNothing);

      router.go('/');
      await tester.pumpAndSettle();

      // Onceden `profileStatsProvider` duz bir `FutureProvider`'di ve
      // ProviderContainer omru boyunca sonucu onbellekte tutuyordu; hicbir
      // booking akisi onu invalidate etmedigi icin istatistikler ilk
      // yuklemeden sonra bayatliyordu (2026-09-09'da bulundu).
      // `.autoDispose` sayesinde sekmeden cikilip geri donulunce (ShellRoute
      // altinda ProfileScreen tamamen unmount/remount oluyor) istek
      // tazeleniyor.
      expect(
        callCount,
        2,
        reason:
            'ProfileScreen yeniden mount edildiginde /profile/stats '
            'yeniden cagrilmali',
      );
    });
  });
}
